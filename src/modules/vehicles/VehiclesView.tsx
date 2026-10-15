import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { Vehicle, VehicleDocument } from '../../types/index.ts';
import { Modal } from '../../components/common/Modal.tsx';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { formatWeight } from '../../utils/calculations.ts';
import { 
  Car, 
  Plus, 
  Calendar, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Clock 
} from 'lucide-react';

export const VehiclesView: React.FC = () => {
  const { vehicles, vehicleDocuments, expenses } = useERP();
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Vehicles & Document Compliance</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Fleet registry, automated document expiry alerts (RC, Insurance, Fitness), and maintenance history.
          </p>
        </div>
      </div>

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
                <StatusBadge status={veh.ownershipType} />
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
    </div>
  );
};
