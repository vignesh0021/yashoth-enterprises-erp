import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { CashBankAccount, Expense, AccountTransaction } from '../../types/index.ts';
import { Modal } from '../../components/common/Modal.tsx';
import { formatINR } from '../../utils/calculations.ts';
import { calculateReconciledAccountBalance } from '../../../backend/business-rules/financeEngine.ts';
import { 
  Wallet, 
  ArrowLeftRight, 
  Plus, 
  Building2, 
  Coins, 
  ArrowDownLeft, 
  ArrowUpRight,
  Edit3,
  Trash2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export const FinanceView: React.FC = () => {
  const { 
    accounts, 
    accountTransactions, 
    expenses, 
    vehicles, 
    recordContraTransfer, 
    recordExpense, 
    updateExpense,
    deleteExpense,
    addAccount,
    updateAccount,
    deleteAccount,
    updateAccountTransaction,
    deleteAccountTransaction,
    currentUser 
  } = useERP();

  const [activeTab, setActiveTab] = useState<'ACCOUNTS' | 'TRANSACTIONS' | 'EXPENSES'>('ACCOUNTS');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Contra Transfer Modal State
  const [isContraModalOpen, setIsContraModalOpen] = useState(false);
  const [sourceAccId, setSourceAccId] = useState(accounts[0]?.id || '');
  const [destAccId, setDestAccId] = useState(accounts[1]?.id || '');
  const [contraAmount, setContraAmount] = useState<number>(20000);
  const [contraRef, setContraRef] = useState('CHQ-DEP-' + Math.floor(1000 + Math.random() * 9000));

  // Expense Modal State (Add / Edit)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseCategory, setExpenseCategory] = useState('Transport & Freight');
  const [expenseAmount, setExpenseAmount] = useState<number>(1500);
  const [expenseAccId, setExpenseAccId] = useState(accounts[0]?.id || '');
  const [vehicleId, setVehicleId] = useState('');
  const [paidTo, setPaidTo] = useState('Sri Krishna Lorry Service');
  const [billRef, setBillRef] = useState('LR-4019');
  const [expenseNotes, setExpenseNotes] = useState('Scrap transport charges for yard');

  // Account Modal State (Add / Edit)
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CashBankAccount | null>(null);
  const [accCode, setAccCode] = useState('');
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<'CASH' | 'BANK'>('BANK');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(50000);

  // Transaction Edit Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<AccountTransaction | null>(null);
  const [txDate, setTxDate] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txRef, setTxRef] = useState('');
  const [txAmount, setTxAmount] = useState<number>(0);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // ------------------ Contra Transfer ------------------
  const handleContraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceAccId === destAccId) {
      showFeedback('error', 'Source and destination accounts must be different for contra transfers.');
      return;
    }
    recordContraTransfer(sourceAccId, destAccId, contraAmount, contraRef);
    setIsContraModalOpen(false);
    showFeedback('success', `Contra transfer of ${formatINR(contraAmount)} executed successfully.`);
  };

  // ------------------ Expense CRUD ------------------
  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setExpenseCategory('Transport & Freight');
    setExpenseAmount(1500);
    setExpenseAccId(accounts[0]?.id || '');
    setVehicleId('');
    setPaidTo('Sri Krishna Lorry Service');
    setBillRef('LR-4019');
    setExpenseNotes('Scrap transport charges for yard');
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    setExpenseDate(exp.expenseDate);
    setExpenseCategory(exp.category);
    setExpenseAmount(exp.amount);
    setExpenseAccId(exp.accountId);
    setVehicleId(exp.vehicleId || '');
    setPaidTo(exp.paidTo);
    setBillRef(exp.billReference || '');
    setExpenseNotes(exp.notes || '');
    setIsExpenseModalOpen(true);
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0) {
      showFeedback('error', 'Expense amount must be greater than zero.');
      return;
    }

    if (editingExpense) {
      updateExpense(editingExpense.id, {
        expenseDate,
        category: expenseCategory,
        amount: Number(expenseAmount),
        accountId: expenseAccId,
        vehicleId: vehicleId || undefined,
        paidTo,
        billReference: billRef || undefined,
        notes: expenseNotes,
      });
      showFeedback('success', `Expense voucher "${editingExpense.voucherNo}" updated successfully.`);
    } else {
      const newExp = recordExpense({
        expenseDate,
        category: expenseCategory,
        amount: Number(expenseAmount),
        accountId: expenseAccId,
        vehicleId: vehicleId || undefined,
        paidTo,
        billReference: billRef,
        notes: expenseNotes,
        createdBy: currentUser.fullName,
      });
      showFeedback('success', `Expense voucher "${newExp.voucherNo}" recorded.`);
    }
    setIsExpenseModalOpen(false);
  };

  const handleDeleteExpense = (exp: Expense) => {
    if (confirm(`Are you sure you want to delete expense voucher "${exp.voucherNo}" for ${formatINR(exp.amount)}? The funds will be credited back to the ledger.`)) {
      const res = deleteExpense(exp.id);
      if (res.success) {
        showFeedback('success', res.message || 'Expense deleted.');
      } else {
        showFeedback('error', res.message || 'Failed to delete expense.');
      }
    }
  };

  // ------------------ Account CRUD ------------------
  const handleOpenAddAccount = () => {
    setEditingAccount(null);
    const nextSeq = accounts.length + 1;
    setAccCode(`ACC-26-${String(nextSeq).padStart(3, '0')}`);
    setAccName('');
    setAccType('BANK');
    setBankName('City Union Bank');
    setAccountNumber('510909010195638');
    setIfscCode('CIUB0000439');
    setOpeningBalance(50000);
    setIsAccountModalOpen(true);
  };

  const handleOpenEditAccount = (acc: CashBankAccount) => {
    setEditingAccount(acc);
    setAccCode(acc.accountCode);
    setAccName(acc.accountName);
    setAccType(acc.accountType);
    setBankName(acc.bankName || '');
    setAccountNumber(acc.accountNumber || '');
    setIfscCode(acc.ifscCode || '');
    setOpeningBalance(acc.openingBalance);
    setIsAccountModalOpen(true);
  };

  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;

    if (editingAccount) {
      updateAccount(editingAccount.id, {
        accountCode: accCode.trim().toUpperCase(),
        accountName: accName.trim(),
        accountType: accType,
        bankName: accType === 'BANK' ? bankName.trim() : undefined,
        accountNumber: accType === 'BANK' ? accountNumber.trim() : undefined,
        ifscCode: accType === 'BANK' ? ifscCode.trim().toUpperCase() : undefined,
        openingBalance: Number(openingBalance),
      });
      showFeedback('success', `Account "${accName}" updated successfully.`);
    } else {
      addAccount({
        accountCode: accCode.trim().toUpperCase(),
        accountName: accName.trim(),
        accountType: accType,
        bankName: accType === 'BANK' ? bankName.trim() : undefined,
        accountNumber: accType === 'BANK' ? accountNumber.trim() : undefined,
        ifscCode: accType === 'BANK' ? ifscCode.trim().toUpperCase() : undefined,
        openingBalance: Number(openingBalance),
        openingBalanceDate: new Date().toISOString().split('T')[0],
        isActive: true,
      });
      showFeedback('success', `New account "${accName}" created successfully.`);
    }
    setIsAccountModalOpen(false);
  };

  const handleDeleteAccount = (acc: CashBankAccount) => {
    if (confirm(`Are you sure you want to remove account "${acc.accountName}"?`)) {
      const res = deleteAccount(acc.id);
      if (res.success) {
        showFeedback('success', res.message || 'Account deleted.');
      } else {
        showFeedback('error', res.message || 'Failed to delete account.');
      }
    }
  };

  // ------------------ Transaction CRUD ------------------
  const handleOpenEditTx = (tx: AccountTransaction) => {
    setEditingTx(tx);
    setTxDate(tx.transactionDate);
    setTxDesc(tx.description);
    setTxRef(tx.referenceNo || '');
    setTxAmount(tx.amount);
    setIsTxModalOpen(true);
  };

  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    updateAccountTransaction(editingTx.id, {
      transactionDate: txDate,
      description: txDesc,
      referenceNo: txRef || undefined,
      amount: Number(txAmount),
    });
    setIsTxModalOpen(false);
    showFeedback('success', 'Transaction entry updated.');
  };

  const handleDeleteTx = (tx: AccountTransaction) => {
    if (confirm(`Delete transaction "${tx.description}" (${formatINR(tx.amount)})?`)) {
      const res = deleteAccountTransaction(tx.id);
      if (res.success) {
        showFeedback('success', res.message || 'Transaction deleted.');
      } else {
        showFeedback('error', res.message || 'Failed to delete transaction.');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-red-600" />
            <span>Funds, Cashbook & Expense Vouchers</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Full CRUD operations for Cash/Bank accounts, expense vouchers, contra transfers, and ledger adjustment logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenAddAccount}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span>+ Add Account</span>
          </button>
          <button
            onClick={() => setIsContraModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-red-400" />
            <span>Cash ⇄ Bank Contra Transfer</span>
          </button>
          <button
            onClick={handleOpenAddExpense}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Expense Voucher</span>
          </button>
        </div>
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

      {/* Account Balances Cards with Edit / Delete */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Authorised Cash & Bank Accounts ({accounts.length})
          </span>
          <span className="text-[11px] text-slate-400">Click edit icon on any card to modify account details</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const balance = calculateReconciledAccountBalance(acc, accountTransactions);
            const isBank = acc.accountType === 'BANK';

            return (
              <div 
                key={acc.id} 
                className={`p-5 rounded-xl border shadow-sm flex flex-col justify-between transition-all ${
                  acc.isActive !== false ? 'bg-white border-slate-200' : 'bg-slate-50 border-dashed border-slate-300 opacity-70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      {isBank ? <Building2 className="w-4 h-4 text-blue-600" /> : <Coins className="w-4 h-4 text-amber-600" />}
                      <span>{acc.accountType} Account</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[10px] text-slate-400 font-semibold">{acc.accountCode}</span>
                      <button
                        onClick={() => handleOpenEditAccount(acc)}
                        className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Edit Account Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(acc)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete / Deactivate Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="my-3">
                    <h3 className="font-bold text-slate-900 text-base">{acc.accountName}</h3>
                    {acc.bankName && (
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {acc.bankName} · A/c: {acc.accountNumber} · IFSC: {acc.ifscCode}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      Opening Balance: <span className="font-mono font-semibold">{formatINR(acc.openingBalance)}</span>
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Reconciled Balance</span>
                  <span className="font-mono font-black text-lg text-slate-900">{formatINR(balance)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('ACCOUNTS')}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeTab === 'ACCOUNTS' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Daily Account Transactions ({accountTransactions.length})
        </button>
        <button
          onClick={() => setActiveTab('EXPENSES')}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeTab === 'EXPENSES' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Expense Vouchers Register ({expenses.length})
        </button>
      </div>

      {/* Transactions Table with Edit / Delete */}
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
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {accountTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-sans italic">
                      No account transactions logged yet.
                    </td>
                  </tr>
                ) : (
                  accountTransactions.map((tx) => {
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
                        <td className="py-3 px-4 text-right font-sans">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditTx(tx)}
                              className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded cursor-pointer"
                              title="Edit transaction"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTx(tx)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Delete transaction"
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
      )}

      {/* Expenses Table with Full Edit & Delete */}
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
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 italic">
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
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditExpense(exp)}
                              className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Edit Expense Voucher"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp)}
                              className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete Expense Voucher"
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
      )}

      {/* ========================================================================= */}
      {/* CASH ⇄ BANK CONTRA TRANSFER MODAL                                         */}
      {/* ========================================================================= */}
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
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm cursor-pointer"
            >
              Execute Contra Transfer
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* EXPENSE VOUCHER MODAL (ADD / EDIT)                                        */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title={editingExpense ? `Edit Expense Voucher: ${editingExpense.voucherNo}` : 'Record Operating Expense Voucher'}
        subtitle="Capture transport, fuel, weighbridge, and yard operational expenses."
      >
        <form onSubmit={handleExpenseSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Expense Date *</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                required
              />
            </div>

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
                <option value="Yard Loading & Unloading">Yard Loading & Unloading</option>
                <option value="Weighbridge Slip Charges">Weighbridge Slip Charges</option>
                <option value="Utilities & Electricity">Utilities & Electricity</option>
                <option value="Refreshments & Tea">Refreshments & Tea</option>
                <option value="Office & Administration">Office & Administration</option>
                <option value="Other Operating Expense">Other Operating Expense</option>
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
              <label className="font-bold text-slate-700 block mb-1">Paid From Account *</label>
              <select
                value={expenseAccId}
                onChange={(e) => setExpenseAccId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white font-semibold"
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
              <label className="font-bold text-slate-700 block mb-1">Paid To / Vendor *</label>
              <input
                type="text"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-semibold"
                placeholder="e.g. Sri Krishna Lorry Service, Bharat Petroleum"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Bill / LR / Challan Ref #</label>
              <input
                type="text"
                value={billRef}
                onChange={(e) => setBillRef(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                placeholder="e.g. LR-9901, BILL-102"
              />
            </div>

            <div className="col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Linked Vehicle (Optional)</label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono"
              >
                <option value="">No Vehicle Linked</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNo} — {v.vehicleType}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Expense Remarks / Description</label>
              <textarea
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg h-16"
                placeholder="Provide context on why this operational expense was incurred..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsExpenseModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm cursor-pointer"
            >
              {editingExpense ? 'Update Expense' : 'Save Expense Voucher'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* CASH & BANK ACCOUNT MODAL (ADD / EDIT)                                    */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title={editingAccount ? `Edit Account: ${editingAccount.accountName}` : 'Add New Cash / Bank Account'}
        subtitle="Manage cash boxes and commercial bank accounts in the general ledger."
      >
        <form onSubmit={handleAccountSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Account Code *</label>
              <input
                type="text"
                value={accCode}
                onChange={(e) => setAccCode(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Account Type *</label>
              <select
                value={accType}
                onChange={(e) => setAccType(e.target.value as 'CASH' | 'BANK')}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white font-bold"
              >
                <option value="BANK">BANK (Commercial Account)</option>
                <option value="CASH">CASH (Yard Cash Box)</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Account Display Name *</label>
              <input
                type="text"
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-bold"
                placeholder="e.g. City Union Bank - Main, Gummidipoondi Cash Box"
                required
              />
            </div>

            {accType === 'BANK' && (
              <>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg"
                    placeholder="e.g. City Union Bank"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Account Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                    placeholder="e.g. 510909010195638"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg font-mono uppercase"
                    placeholder="e.g. CIUB0000439"
                  />
                </div>
              </>
            )}

            <div>
              <label className="font-bold text-slate-700 block mb-1">Opening Balance (₹) *</label>
              <input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm cursor-pointer"
            >
              {editingAccount ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* TRANSACTION EDIT MODAL                                                    */}
      {/* ========================================================================= */}
      {editingTx && (
        <Modal
          isOpen={isTxModalOpen}
          onClose={() => setIsTxModalOpen(false)}
          title="Edit Account Transaction"
          subtitle="Correct date, reference number, or description for audited account transaction."
        >
          <form onSubmit={handleTxSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Transaction Date *</label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  value={txAmount}
                  onChange={(e) => setTxAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Reference / Cheque #</label>
                <input
                  type="text"
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div className="col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Description *</label>
                <input
                  type="text"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsTxModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm cursor-pointer"
              >
                Save Transaction Changes
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
