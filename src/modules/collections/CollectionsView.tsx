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
  ArrowRight 
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
    currentUser 
  } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<CollectionJob | null>(null);

  // Form State
  const [supplierId, setSupplierId] = useState(parties[0]?.id || '');
  const [location, setLocation] = useState('SIPCOT Phase 2, Unit 4B, Gummidipoondi');
  const [materialId, setMaterialId] = useState(materials[0]?.id || '');
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || '');
  const [staffId, setStaffId] = useState(employees[0]?.id || '');
  const [estimatedQty, setEstimatedQty] = useState(5000);
  const [transportExpenses, setTransportExpenses] = useState(1200);
  const [notes, setNotes] = useState('Factory machinery scrap batch');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createCollectionJob({
      supplierPartyId: supplierId,
      pickupLocation: location,
      materialId,
      plannedDate,
      assignedVehicleId: vehicleId,
      assignedStaffId: staffId,
      estimatedQuantity: estimatedQty,
      actualWeight: 0,
      transportExpenses,
      status: 'ASSIGNED',
      notes,
    });
    setIsModalOpen(false);
  };

  const handleAdvanceStatus = (job: CollectionJob) => {
    if (job.status === 'REQUESTED') {
      updateCollectionStatus(job.id, 'ASSIGNED');
    } else if (job.status === 'ASSIGNED') {
      updateCollectionStatus(job.id, 'IN_TRANSIT');
    } else if (job.status === 'IN_TRANSIT') {
      // Simulate arrival and weighment at yard
      const actual = job.estimatedQuantity * 0.98; // Realistic slight variance
      updateCollectionStatus(job.id, 'WEIGHED', actual);
    } else if (job.status === 'WEIGHED') {
      updateCollectionStatus(job.id, 'COMPLETED');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Collection & Logistics Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Coordinate scrap pickups from factories and sites. Unweighed estimates do NOT affect stock until weighment.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Collection Request</span>
        </button>
      </div>

      {/* Collections Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Job No</th>
                <th className="py-3 px-4">Pickup Date</th>
                <th className="py-3 px-4">Supplier / Source</th>
                <th className="py-3 px-4">Material</th>
                <th className="py-3 px-4">Vehicle & Staff</th>
                <th className="py-3 px-4 text-right">Estimated Qty</th>
                <th className="py-3 px-4 text-right">Actual Weight</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {collectionJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                    No active collection requests. Click "+ New Collection Request" to dispatch a vehicle.
                  </td>
                </tr>
              ) : (
                collectionJobs.map((job) => {
                  const supplier = parties.find((p) => p.id === job.supplierPartyId);
                  const mat = materials.find((m) => m.id === job.materialId);
                  const veh = vehicles.find((v) => v.id === job.assignedVehicleId);
                  const staff = employees.find((e) => e.id === job.assignedStaffId);

                  return (
                    <tr key={job.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{job.jobNo}</td>
                      <td className="py-3 px-4 text-slate-600">{job.plannedDate}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">{supplier?.legalName}</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-red-500" />
                          {job.pickupLocation}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">{mat?.name}</td>
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
                        {job.status !== 'COMPLETED' && (
                          <button
                            onClick={() => handleAdvanceStatus(job)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-bold shadow-sm transition-all"
                          >
                            Advance →
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Factory Scrap Pickup"
        subtitle="Dispatch logistics vehicle and driver to collect scrap on site."
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Supplier / Factory *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
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
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
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
              <label className="font-bold text-slate-700 block mb-1">Assigned Vehicle</label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
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
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} ({e.designation})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Estimated Quantity (KG)</label>
              <input
                type="number"
                value={estimatedQty}
                onChange={(e) => setEstimatedQty(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Planned Pickup Date</label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm"
            >
              Create Pickup Order
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
