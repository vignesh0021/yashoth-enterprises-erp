import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { PaymentDirection, PaymentMethod, Payment } from '../../types/index.ts';
import { Modal } from '../../components/common/Modal.tsx';
import { formatINR } from '../../utils/calculations.ts';
import { 
  CreditCard, 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Edit2,
  Trash2 
} from 'lucide-react';

export const PaymentsView: React.FC = () => {
  const { 
    payments, 
    parties, 
    accounts, 
    invoices, 
    purchases, 
    recordPayment, 
    updatePayment,
    deletePayment,
    currentUser 
  } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [direction, setDirection] = useState<PaymentDirection>('INFLOW_RECEIPT');
  const [partyId, setPartyId] = useState(parties[0]?.id || '');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [totalAmount, setTotalAmount] = useState<number>(50000);
  const [method, setMethod] = useState<PaymentMethod>('NEFT_RTGS');
  const [referenceNo, setReferenceNo] = useState('UTR-' + Math.floor(100000 + Math.random() * 900000));
  const [notes, setNotes] = useState('Payment settlement');
  const [allocatedInvoiceId, setAllocatedInvoiceId] = useState('');

  // Edit Payment State
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editAccountId, setEditAccountId] = useState('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editMethod, setEditMethod] = useState<PaymentMethod>('NEFT_RTGS');
  const [editReferenceNo, setEditReferenceNo] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Unpaid invoices for the selected customer
  const eligibleInvoices = invoices.filter(
    (inv) => inv.customerPartyId === partyId && inv.paymentStatus !== 'PAID' && !inv.isCancelled
  );

  // Unpaid purchases for the selected supplier
  const eligiblePurchases = purchases.filter(
    (p) => p.supplierPartyId === partyId && p.status === 'POSTED' && p.outstandingBalance > 0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedParty = parties.find((p) => p.id === partyId);
    const selectedAccount = accounts.find((a) => a.id === accountId);
    if (!selectedParty || !selectedAccount) return;

    const allocations = [];
    if (direction === 'INFLOW_RECEIPT' && allocatedInvoiceId) {
      allocations.push({
        invoiceId: allocatedInvoiceId,
        allocatedAmount: totalAmount,
      });
    }

    const seq = payments.length + 1;
    const paymentNo = `VOUCH-26-${String(seq).padStart(4, '0')}`;

    recordPayment({
      paymentNo,
      paymentDate: new Date().toISOString().split('T')[0],
      direction,
      party: selectedParty,
      account: selectedAccount,
      totalAmount,
      paymentMethod: method,
      referenceNo,
      notes,
      allocations,
      allInvoices: invoices,
      allPurchases: purchases,
      actor: currentUser.fullName,
    });

    setIsModalOpen(false);
  };

  const handleOpenEdit = (pay: Payment) => {
    setEditingPayment(pay);
    setEditDate(pay.paymentDate);
    setEditAccountId(pay.accountId);
    setEditAmount(pay.totalAmount);
    setEditMethod(pay.paymentMethod);
    setEditReferenceNo(pay.referenceNo || '');
    setEditNotes(pay.notes || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    updatePayment(editingPayment.id, {
      paymentDate: editDate,
      accountId: editAccountId,
      totalAmount: editAmount,
      paymentMethod: editMethod,
      referenceNo: editReferenceNo,
      notes: editNotes,
    });
    setEditingPayment(null);
  };

  const handleDeletePayment = (pay: Payment) => {
    if (window.confirm(`Are you sure you want to delete Payment Voucher "${pay.paymentNo}" for ${formatINR(pay.totalAmount)}? This will remove the voucher and reverse the account ledger.`)) {
      const res = deletePayment(pay.id);
      if (!res.success) {
        alert(res.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Payments, Receipts & Outstanding</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record customer collections and supplier disbursements with multi-invoice allocations and cash/bank reconciliation.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Record Payment Voucher</span>
        </button>
      </div>

      {/* Payments List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Voucher No</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Party</th>
                <th className="py-3 px-4">Account Used</th>
                <th className="py-3 px-4">Method & Ref</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Unallocated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                    No payment vouchers recorded yet. Click "Record Payment Voucher" to log collections or payouts.
                  </td>
                </tr>
              ) : (
                payments.map((pay) => {
                  const party = parties.find((p) => p.id === pay.partyId);
                  const account = accounts.find((a) => a.id === pay.accountId);
                  const isReceipt = pay.direction === 'INFLOW_RECEIPT';

                  return (
                    <tr key={pay.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{pay.paymentNo}</td>
                      <td className="py-3 px-4 text-slate-600">{pay.paymentDate}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isReceipt ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {isReceipt ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {isReceipt ? 'Customer Receipt' : 'Supplier Payment'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{party?.legalName}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">{account?.accountName}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold block">{pay.paymentMethod}</span>
                        {pay.referenceNo && <span className="text-[10px] text-slate-500 font-mono">{pay.referenceNo}</span>}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-black text-sm ${
                        isReceipt ? 'text-emerald-700' : 'text-slate-900'
                      }`}>
                        {formatINR(pay.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {pay.unallocatedAmount > 0 ? formatINR(pay.unallocatedAmount) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(pay)}
                            className="p-1 hover:bg-amber-50 text-amber-600 rounded transition-colors"
                            title="Edit Payment Voucher"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePayment(pay)}
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded transition-colors"
                            title="Delete Payment Voucher"
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

      {/* Record Payment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Financial Payment Voucher"
        subtitle="Automatic party ledger and cash/bank account ledger updating."
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Voucher Direction *</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as any)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="INFLOW_RECEIPT">Money Received (Customer Receipt)</option>
                <option value="OUTFLOW_PAYMENT">Money Paid (Supplier Payment)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Party (Customer / Supplier) *</label>
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                required
              >
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.legalName} ({p.partyType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Settlement Account *</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                required
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountName} ({a.accountType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="NEFT_RTGS">NEFT / RTGS Bank Transfer</option>
                <option value="CASH">Cash Currency</option>
                <option value="UPI">UPI Digital Payment</option>
                <option value="CHEQUE">Cheque / Demand Draft</option>
                <option value="IMPS">IMPS Immediate Transfer</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Voucher Amount (₹) *</label>
              <input
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono text-sm font-bold"
                min="1"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">External Reference / UTR #</label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                placeholder="e.g. UTR-20261015-889"
              />
            </div>
          </div>

          {direction === 'INFLOW_RECEIPT' && eligibleInvoices.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <label className="font-bold text-slate-700 block mb-1">Allocate against Unpaid Invoice (Optional)</label>
              <select
                value={allocatedInvoiceId}
                onChange={(e) => setAllocatedInvoiceId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Leave Unallocated / Advance</option>
                {eligibleInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNo} — Outstanding: {formatINR(inv.outstandingBalance)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="font-bold text-slate-700 block mb-1">Notes / Description</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg"
              placeholder="e.g. Bank settlement against dispatch"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
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
              Post Payment Voucher
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Payment Modal */}
      {editingPayment && (
        <Modal
          isOpen={!!editingPayment}
          onClose={() => setEditingPayment(null)}
          title={`Edit Payment Voucher — ${editingPayment.paymentNo}`}
          subtitle="Update voucher date, settlement account, amount, and payment details."
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Voucher Date *</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Settlement Account *</label>
                <select
                  value={editAccountId}
                  onChange={(e) => setEditAccountId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                  required
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} ({a.accountType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
                <select
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value as any)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="NEFT_RTGS">NEFT / RTGS Bank Transfer</option>
                  <option value="CASH">Cash Currency</option>
                  <option value="UPI">UPI Digital Payment</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                  <option value="IMPS">IMPS Immediate Transfer</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Voucher Amount (₹) *</label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono text-sm font-bold"
                  min="1"
                  step="0.01"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="font-bold text-slate-700 block mb-1">External Reference / UTR #</label>
                <input
                  type="text"
                  value={editReferenceNo}
                  onChange={(e) => setEditReferenceNo(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                  placeholder="e.g. UTR-20261015-889"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Notes / Description</label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
                placeholder="e.g. Bank settlement against dispatch"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingPayment(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
