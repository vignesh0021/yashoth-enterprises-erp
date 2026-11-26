import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { formatWeight } from '../../utils/calculations.ts';
import { getLocalDateStr } from '../../utils/visualReportExporter.ts';
import type { GodownTransfer, GodownTransferStatus } from '../../types/index.ts';
import {
  ArrowLeftRight,
  Plus,
  Send,
  PackageCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Truck,
} from 'lucide-react';

const STATUS_BADGE_MAP: Record<GodownTransferStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  APPROVED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  IN_TRANSIT: 'bg-sky-50 text-sky-800 border-sky-200',
  PARTIALLY_RECEIVED: 'bg-orange-50 text-orange-800 border-orange-200',
  RECEIVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  DISPUTED: 'bg-rose-50 text-rose-800 border-rose-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200 line-through',
};

export const GodownTransfersTab: React.FC = () => {
  const {
    yards,
    materials,
    godownTransfers,
    createTransfer,
    dispatchTransfer,
    receiveTransfer,
    disputeTransfer,
    cancelTransfer,
    currentUser,
  } = useERP();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [receivingTransfer, setReceivingTransfer] = useState<GodownTransfer | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create form state
  const [sourceYardId, setSourceYardId] = useState(yards[0]?.id || '');
  const [destinationYardId, setDestinationYardId] = useState(yards[1]?.id || yards[0]?.id || '');
  const [materialId, setMaterialId] = useState(materials[0]?.id || '');
  const [quantityDispatched, setQuantityDispatched] = useState<number>(0);
  const [vehicleReg, setVehicleReg] = useState('');
  const [driverName, setDriverName] = useState('');
  const [transferDate, setTransferDate] = useState(getLocalDateStr());
  const [expectedDate, setExpectedDate] = useState(getLocalDateStr());
  const [notes, setNotes] = useState('');

  // Receive form state
  const [receivedQty, setReceivedQty] = useState<number>(0);
  const [receiveDate, setReceiveDate] = useState(getLocalDateStr());
  const [finalizeShortage, setFinalizeShortage] = useState(false);
  const [receiveNotes, setReceiveNotes] = useState('');

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const trf = createTransfer({
        sourceYardId,
        destinationYardId,
        materialId,
        quantityDispatched: Number(quantityDispatched),
        vehicleRegistration: vehicleReg || 'TN18BY0420',
        driverName: driverName.trim() || undefined,
        dispatchEmployee: currentUser.fullName,
        transferDate,
        expectedDate,
        status: 'APPROVED',
        notes: notes.trim() || undefined,
      });
      setIsCreateOpen(false);
      setQuantityDispatched(0);
      setNotes('');
      showToast('success', `Transfer ${trf.transferNo} created. Dispatch it to deduct stock from source godown.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to create transfer.');
    }
  };

  const handleDispatch = (trf: GodownTransfer) => {
    try {
      dispatchTransfer(trf.id);
      showToast('success', `Transfer ${trf.transferNo} dispatched (IN_TRANSIT). Stock deducted from source godown.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Dispatch failed.');
    }
  };

  const handleReceiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingTransfer) return;
    try {
      const updated = receiveTransfer(receivingTransfer.id, {
        receivedQuantity: Number(receivedQty),
        receivedDate: receiveDate,
        receivingEmployee: currentUser.fullName,
        idempotencyKey: `rcv-${receivingTransfer.id}-${Date.now()}`,
        finalizeWithShortage: finalizeShortage,
        notes: receiveNotes.trim() || undefined,
      });
      setReceivingTransfer(null);
      setReceiveNotes('');
      setFinalizeShortage(false);
      showToast(
        'success',
        `Receipt recorded for ${updated.transferNo}. Status: ${updated.status} (Received ${formatWeight(updated.quantityReceived)}).`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to confirm receipt.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-red-600" />
            <span>Internal Godown Transfers (Stock Neutral)</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Transfers are neither purchases nor sales. Source stock deducts on dispatch; destination stock adds only when receipt is confirmed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Godown Transfer</span>
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
                <th className="py-3 px-4">Transfer #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Route (Source → Dest)</th>
                <th className="py-3 px-4">Material</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4 text-right">Dispatched</th>
                <th className="py-3 px-4 text-right">Received</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {godownTransfers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 italic">
                    No internal godown transfers recorded yet.
                  </td>
                </tr>
              ) : (
                godownTransfers.map((t) => {
                  const src = yards.find((y) => y.id === t.sourceYardId)?.name || t.sourceYardId;
                  const dst = yards.find((y) => y.id === t.destinationYardId)?.name || t.destinationYardId;
                  const mat = materials.find((m) => m.id === t.materialId)?.name || t.materialId;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{t.transferNo}</td>
                      <td className="py-3 px-4 text-slate-600">{t.transferDate}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {src} <span className="text-slate-400">→</span> {dst}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{mat}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <Truck className="w-3 h-3 text-slate-400" />
                          {t.vehicleRegistration}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">{formatWeight(t.quantityDispatched)}</td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className="font-bold text-emerald-700">{formatWeight(t.quantityReceived)}</span>
                        {t.shortageQuantity > 0 && (
                          <span className="block text-[10px] text-rose-600">Short: {formatWeight(t.shortageQuantity)}</span>
                        )}
                        {t.excessQuantity > 0 && (
                          <span className="block text-[10px] text-amber-600">Excess: +{formatWeight(t.excessQuantity)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_BADGE_MAP[t.status]}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {['DRAFT', 'APPROVED', 'PENDING'].includes(t.status) && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDispatch(t)}
                                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Send className="w-3 h-3" /> Dispatch
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    cancelTransfer(t.id, 'Cancelled before dispatch');
                                    showToast('success', `Transfer ${t.transferNo} cancelled.`);
                                  } catch (err: any) {
                                    showToast('error', err.message);
                                  }
                                }}
                                className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg cursor-pointer"
                                title="Cancel Transfer"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {['IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(t.status) && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setReceivingTransfer(t);
                                  setReceivedQty(Math.max(0, t.quantityDispatched - t.quantityReceived));
                                  setReceiveDate(getLocalDateStr());
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <PackageCheck className="w-3 h-3" /> Receive
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const reason = window.prompt('Enter dispute reason for ' + t.transferNo);
                                  if (reason) {
                                    disputeTransfer(t.id, reason);
                                    showToast('error', `Transfer ${t.transferNo} marked DISPUTED.`);
                                  }
                                }}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold cursor-pointer"
                              >
                                Dispute
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

      {/* Create Transfer Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="New Internal Godown Transfer"
        subtitle="Move scrap between godowns with full weighment and receipt verification."
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Source Godown</label>
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
            <div>
              <label className="block font-bold text-slate-700 mb-1">Destination Godown</label>
              <select
                value={destinationYardId}
                onChange={(e) => setDestinationYardId(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
              >
                {yards.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Material</label>
              <select
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Quantity to Dispatch (KG)</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={quantityDispatched || ''}
                onChange={(e) => setQuantityDispatched(Number(e.target.value))}
                className="w-full p-2.5 border border-slate-200 rounded-xl font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Vehicle Reg #</label>
              <input
                type="text"
                required
                placeholder="TN18BY0420"
                value={vehicleReg}
                onChange={(e) => setVehicleReg(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Driver Name</label>
              <input
                type="text"
                placeholder="Driver name"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Transfer Date</label>
              <input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Expected Receipt Date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Weighment slip ref / remarks"
              className="w-full p-2.5 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold cursor-pointer">
              Create Transfer
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Receipt Modal */}
      <Modal
        isOpen={Boolean(receivingTransfer)}
        onClose={() => setReceivingTransfer(null)}
        title={`Confirm Receipt: ${receivingTransfer?.transferNo || ''}`}
        subtitle="Destination stock is added only when receipt is confirmed. Partial receipts & shortages are tracked."
      >
        <form onSubmit={handleReceiveSubmit} className="space-y-4 text-xs">
          {receivingTransfer && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
              <span>Dispatched: <strong>{formatWeight(receivingTransfer.quantityDispatched)}</strong></span>
              <span>Already Received: <strong>{formatWeight(receivingTransfer.quantityReceived)}</strong></span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Received Quantity (KG)</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={receivedQty || ''}
                onChange={(e) => setReceivedQty(Number(e.target.value))}
                className="w-full p-2.5 border border-slate-200 rounded-xl font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Receiving Date</label>
              <input
                type="date"
                value={receiveDate}
                onChange={(e) => setReceiveDate(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-slate-700 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={finalizeShortage}
              onChange={(e) => setFinalizeShortage(e.target.checked)}
            />
            <span>Finalize remaining shortage as DISPUTED (uncheck for partial receipt expecting balance)</span>
          </label>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Receiving Remarks</label>
            <input
              type="text"
              value={receiveNotes}
              onChange={(e) => setReceiveNotes(e.target.value)}
              placeholder="Receiving weighbridge bill / notes"
              className="w-full p-2.5 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setReceivingTransfer(null)} className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer">
              Confirm Stock Receipt
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
