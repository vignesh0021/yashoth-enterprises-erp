import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { CashBankAccount } from '../../types/index.ts';
import { Modal } from '../../components/common/Modal.tsx';
import { formatINR } from '../../utils/calculations.ts';
import { calculateReconciledAccountBalance } from '../../../backend/business-rules/financeEngine.ts';
import { 
  Wallet, 
  ArrowLeftRight, 
  Plus, 
  Receipt, 
  Building2, 
  Coins, 
  ArrowDownLeft, 
  ArrowUpRight 
} from 'lucide-react';

export const FinanceView: React.FC = () => {
  const { 
    accounts, 
    accountTransactions, 
    expenses, 
    vehicles, 
    recordContraTransfer, 
    recordExpense, 
    currentUser 
  } = useERP();

  const [activeTab, setActiveTab] = useState<'ACCOUNTS' | 'TRANSACTIONS' | 'EXPENSES'>('ACCOUNTS');
  const [isContraModalOpen, setIsContraModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Contra Transfer State
  const [sourceAccId, setSourceAccId] = useState(accounts[0]?.id || '');
  const [destAccId, setDestAccId] = useState(accounts[1]?.id || '');
  const [contraAmount, setContraAmount] = useState<number>(20000); // matching PDF example of ₹20,000 cash-to-bank
  const [contraRef, setContraRef] = useState('CHQ-DEP-' + Math.floor(1000 + Math.random() * 9000));

  // Expense Voucher State
  const [expenseCategory, setExpenseCategory] = useState('Transport & Freight');
  const [expenseAmount, setExpenseAmount] = useState<number>(1500);
  const [expenseAccId, setExpenseAccId] = useState(accounts[0]?.id || '');
  const [vehicleId, setVehicleId] = useState('');
  const [paidTo, setPaidTo] = useState('Sri Krishna Lorry Service');
  const [billRef, setBillRef] = useState('LR-4019');
  const [expenseNotes, setExpenseNotes] = useState('Scrap transport charges for yard');

  const handleContraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recordContraTransfer(sourceAccId, destAccId, contraAmount, contraRef);
    setIsContraModalOpen(false);
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recordExpense({
      expenseDate: new Date().toISOString().split('T')[0],
      category: expenseCategory,
      amount: expenseAmount,
      accountId: expenseAccId,
      vehicleId: vehicleId || undefined,
      paidTo,
      billReference: billRef,
      notes: expenseNotes,
      createdBy: currentUser.fullName,
    });
    setIsExpenseModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Funds, Cashbook & Expenses</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict cash and bank account ledgers. Inter-account contra transfers do NOT create revenue or expense.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsContraModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-red-400" />
            <span>Cash ⇄ Bank Contra Transfer</span>
          </button>
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Expense Voucher</span>
          </button>
        </div>
      </div>

      {/* Account Balances Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => {
          const balance = calculateReconciledAccountBalance(acc, accountTransactions);
          const isBank = acc.accountType === 'BANK';

          return (
            <div key={acc.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  {isBank ? <Building2 className="w-4 h-4 text-blue-600" /> : <Coins className="w-4 h-4 text-amber-600" />}
                  {acc.accountType} Account
                </span>
                <span className="font-mono text-[10px] text-slate-400 font-semibold">{acc.accountCode}</span>
              </div>

              <div className="my-3">
                <h3 className="font-bold text-slate-900 text-base">{acc.accountName}</h3>
                {acc.bankName && (
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    A/c: {acc.accountNumber} · IFSC: {acc.ifscCode}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">Reconciled Balance</span>
                <span className="font-mono font-black text-lg text-slate-900">{formatINR(balance)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('ACCOUNTS')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            activeTab === 'ACCOUNTS' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Daily Account Transactions
        </button>
        <button
          onClick={() => setActiveTab('EXPENSES')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            activeTab === 'EXPENSES' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Expense Vouchers Register
        </button>
      </div>

      {/* Transactions Table */}
      {activeTab === 'ACCOUNTS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Ref #</th>
                  <th className="py-3 px-4 text-right">Debit (In)</th>
                  <th className="py-3 px-4 text-right">Credit (Out)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {accountTransactions.map((tx) => {
                  const acc = accounts.find((a) => a.id === tx.accountId);
                  const isDebit = tx.direction === 'DEBIT';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-600">{tx.transactionDate}</td>
                      <td className="py-3 px-4 font-sans font-semibold text-slate-800">{acc?.accountName}</td>
                      <td className="py-3 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {tx.transactionType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-800">{tx.description}</td>
                      <td className="py-3 px-4 text-slate-500">{tx.referenceNo || '—'}</td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700">
                        {isDebit ? formatINR(tx.amount) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-rose-700">
                        {!isDebit ? formatINR(tx.amount) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expenses Table */}
      {activeTab === 'EXPENSES' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Voucher No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Paid To</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4">Bill Ref</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                      No operating expenses recorded yet. Click "+ New Expense Voucher" to log costs.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => {
                    const acc = accounts.find((a) => a.id === exp.accountId);
                    return (
                      <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{exp.voucherNo}</td>
                        <td className="py-3 px-4 text-slate-600">{exp.expenseDate}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{exp.category}</td>
                        <td className="py-3 px-4 font-medium text-slate-700">{exp.paidTo}</td>
                        <td className="py-3 px-4 text-slate-600">{acc?.accountName}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{exp.billReference || '—'}</td>
                        <td className="py-3 px-4 text-right font-mono font-black text-rose-700">{formatINR(exp.amount)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contra Transfer Modal */}
      <Modal
        isOpen={isContraModalOpen}
        onClose={() => setIsContraModalOpen(false)}
        title="Inter-Account Contra Transfer"
        subtitle="Transfer money between cash box and bank accounts without creating revenue or expense."
      >
        <form onSubmit={handleContraSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-[11px]">
            Example: Transferring ₹20,000 from cash to bank atomically credits Cash by ₹20,000 and debits Bank by ₹20,000.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Source Account (Money Out) *</label>
              <select
                value={sourceAccId}
                onChange={(e) => setSourceAccId(e.target.value)}
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
              <label className="font-bold text-slate-700 block mb-1">Destination Account (Money In) *</label>
              <select
                value={destAccId}
                onChange={(e) => setDestAccId(e.target.value)}
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
              <label className="font-bold text-slate-700 block mb-1">Transfer Amount (₹) *</label>
              <input
                type="number"
                value={contraAmount}
                onChange={(e) => setContraAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold text-sm"
                min="1"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Challan / Cheque Ref #</label>
              <input
                type="text"
                value={contraRef}
                onChange={(e) => setContraRef(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsContraModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm"
            >
              Execute Contra Transfer
            </button>
          </div>
        </form>
      </Modal>

      {/* Expense Modal */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="Record Operating Expense Voucher"
        subtitle="Capture transport, fuel, weighbridge, and yard operational expenses."
      >
        <form onSubmit={handleExpenseSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Expense Category *</label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="Transport & Freight">Transport & Freight</option>
                <option value="Vehicle Fuel (Diesel)">Vehicle Fuel (Diesel)</option>
                <option value="Vehicle Maintenance & Repair">Vehicle Maintenance & Repair</option>
                <option value="Public Weighbridge Slip Fees">Public Weighbridge Slip Fees</option>
                <option value="Yard Labor & Loading">Yard Labor & Loading</option>
                <option value="Yard Electricity & Utilities">Yard Electricity & Utilities</option>
                <option value="Tea & Snacks / Welfare">Tea & Snacks / Welfare</option>
                <option value="Office & Administration">Office & Administration</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Settlement Account *</label>
              <select
                value={expenseAccId}
                onChange={(e) => setExpenseAccId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                required
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Amount (₹) *</label>
              <input
                type="number"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold text-sm"
                min="1"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Paid To (Vendor / Person) *</label>
              <input
                type="text"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Linked Vehicle (Optional)</label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="">None / General</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Bill / Receipt Ref #</label>
              <input
                type="text"
                value={billRef}
                onChange={(e) => setBillRef(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Notes</label>
            <input
              type="text"
              value={expenseNotes}
              onChange={(e) => setExpenseNotes(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsExpenseModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm"
            >
              Post Expense Voucher
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
