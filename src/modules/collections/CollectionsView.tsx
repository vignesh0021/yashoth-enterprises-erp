import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { CollectionJob, CollectionStatus } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { formatINR, formatWeight } from '../../utils/calculations.ts';
import { 
  Truck, 
  Plus, 
  MapPin, 
  Calendar, 
  UserCheck, 
  Scale, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  Edit3,
  Trash2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export const CollectionsView: React.FC = () => {
  const { 
    collectionJobs, 
    parties, 
    materials, 
    vehicles, 
    employees, 
    createCollectionJob, 
    updateCollectionStatus,
    updateCollectionJob,
    deleteCollectionJob,
    currentUser 
  } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CollectionJob | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [supplierId, setSupplierId] = useState(parties[0]?.id || '');
  const [location, setLocation] = useState('SIPCOT Phase 2, Unit 4B, Gummidipoondi');
  const [materialId, setMaterialId] = useState(materials[0]?.id || '');
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || '');
  const [staffId, setStaffId] = useState(employees[0]?.id || '');
  const [estimatedQty, setEstimatedQty] = useState(5000);
  const [transportExpenses, setTransportExpenses] = useState(1200);
  const [status, setStatus] = useState<CollectionStatus>('ASSIGNED');
  const [notes, setNotes] = useState('Factory machinery scrap batch');

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleOpenAdd = () => {
    setEditingJob(null);
    setSupplierId(parties[0]?.id || '');
    setLocation('SIPCOT Phase 2, Unit 4B, Gummidipoondi');
    setMaterialId(materials[0]?.id || '');
    setPlannedDate(new Date().toISOString().split('T')[0]);
    setVehicleId(vehicles[0]?.id || '');
    setStaffId(employees[0]?.id || '');
    setEstimatedQty(5000);
    setTransportExpenses(1200);
    setStatus('ASSIGNED');
    setNotes('Factory machinery scrap batch');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (job: CollectionJob) => {
    setEditingJob(job);
    setSupplierId(job.supplierPartyId);
    setLocation(job.pickupLocation);
    setMaterialId(job.materialId);
    setPlannedDate(job.plannedDate);
    setVehicleId(job.assignedVehicleId || vehicles[0]?.id || '');
    setStaffId(job.assignedStaffId || employees[0]?.id || '');
    setEstimatedQty(job.estimatedQuantity);
    setTransportExpenses(job.transportExpenses);
    setStatus(job.status);
    setNotes(job.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !materialId) return;

    if (editingJob) {
      updateCollectionJob(editingJob.id, {
        supplierPartyId: supplierId,
        pickupLocation: location,
        materialId,
        plannedDate,
        assignedVehicleId: vehicleId || undefined,
        assignedStaffId: staffId || undefined,
        estimatedQuantity: Number(estimatedQty),
        transportExpenses: Number(transportExpenses),
        status,
        notes,
      });
      showFeedback('success', `Collection request "${editingJob.jobNo}" updated successfully.`);
    } else {
      const newJob = createCollectionJob({
        supplierPartyId: supplierId,
        pickupLocation: location,
        materialId,
        plannedDate,
        assignedVehicleId: vehicleId || undefined,
        assignedStaffId: staffId || undefined,
        estimatedQuantity: Number(estimatedQty),
        actualWeight: 0,
        transportExpenses: Number(transportExpenses),
        status,
        notes,
      });
      showFeedback('success', `Collection request "${newJob.jobNo}" scheduled.`);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (job: CollectionJob) => {
    if (confirm(`Are you sure you want to delete collection job "${job.jobNo}"?`)) {
      const res = deleteCollectionJob(job.id);
      if (res.success) {
        showFeedback('success', res.message || 'Collection request deleted.');
      } else {
        showFeedback('error', res.message || 'Failed to delete collection request.');
      }
    }
  };

  const handleAdvanceStatus = (job: CollectionJob) => {
    if (job.status === 'REQUESTED') {
      updateCollectionStatus(job.id, 'ASSIGNED');
    } else if (job.status === 'ASSIGNED') {
      updateCollectionStatus(job.id, 'IN_TRANSIT');
    } else if (job.status === 'IN_TRANSIT') {
      // Simulate arrival and weighment at yard
      const actual = job.estimatedQuantity * 0.98;
      updateCollectionStatus(job.id, 'WEIGHED', actual);
    } else if (job.status === 'WEIGHED') {
      updateCollectionStatus(job.id, 'COMPLETED');
    }
    showFeedback('success', `Status advanced for ${job.jobNo}.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-red-600" />
            <span>Collection & Logistics Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Full CRUD operations for coordinating factory scrap pickups, assigning vehicles, drivers, and tracking dispatch progress.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Collection Request</span>
        </button>
      </div>

      {/* Feedback Alert */}
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

      {/* Collections Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Job #</th>
                <th className="py-3 px-4">Supplier & Location</th>
                <th className="py-3 px-4">Material</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Vehicle & Staff</th>
                <th className="py-3 px-4 text-right">Est. Quantity</th>
                <th className="py-3 px-4 text-right">Actual Weight</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {collectionJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                    No collection jobs currently scheduled. Click "+ New Collection Request" to dispatch a pickup.
                  </td>
                </tr>
              ) : (
                collectionJobs.map((job) => {
                  const party = parties.find((p) => p.id === job.supplierPartyId);
                  const mat = materials.find((m) => m.id === job.materialId);
                  const veh = vehicles.find((v) => v.id === job.assignedVehicleId);
                  const staff = employees.find((e) => e.id === job.assignedStaffId);

                  return (
                    <tr key={job.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{job.jobNo}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">{party?.legalName}</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-xs">{job.pickupLocation}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{mat?.name}</td>
                      <td className="py-3 px-4 text-slate-600">{job.plannedDate}</td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-800 font-semibold block">{veh?.registrationNo || '—'}</span>
                        <span className="text-[10px] text-slate-500">{staff?.fullName || '—'}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-500">
                        {formatWeight(job.estimatedQuantity)} (Est.)
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {job.actualWeight ? formatWeight(job.actualWeight) : 'Pending Gate Weigh'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {job.status !== 'COMPLETED' && (
                            <button
                              onClick={() => handleAdvanceStatus(job)}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-bold shadow-sm transition-all cursor-pointer"
                              title="Advance workflow status"
                            >
                              Advance →
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(job)}
                            className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Edit Collection Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(job)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Collection Job"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modal for Add / Edit Collection Request */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingJob ? `Edit Collection Request: ${editingJob.jobNo}` : 'Schedule Factory Scrap Pickup'}
        subtitle="Dispatch logistics vehicle and driver to collect scrap on site."
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Supplier / Factory *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white font-semibold"
                required
              >
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.legalName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Material Scrap Expected *</label>
              <select
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white font-semibold"
                required
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Pickup Site Location *</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Planned Date *</label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Estimated Quantity (KG) *</label>
              <input
                type="number"
                value={estimatedQty}
                onChange={(e) => setEstimatedQty(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Assigned Vehicle</label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono"
              >
                <option value="">No Vehicle Assigned</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNo} ({v.vehicleType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Assigned Driver / Staff</label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="">No Driver Assigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.designation})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Transport & Freight Allowance (₹)</label>
              <input
                type="number"
                value={transportExpenses}
                onChange={(e) => setTransportExpenses(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Workflow Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CollectionStatus)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white font-bold"
              >
                <option value="REQUESTED">REQUESTED</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="IN_TRANSIT">IN TRANSIT</option>
                <option value="WEIGHED">WEIGHED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Job Instructions & Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg h-20"
                placeholder="Specific instructions for site staff, contact person, or gate pass requirements..."
              />
            </div>
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
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm cursor-pointer"
            >
              {editingJob ? 'Save Changes' : 'Schedule Pickup Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
