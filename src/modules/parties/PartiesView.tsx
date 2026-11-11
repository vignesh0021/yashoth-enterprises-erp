import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { Party, PartyType } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { formatINR } from '../../utils/calculations.ts';
import { calculatePartyNetBalance } from '../../../backend/business-rules/financeEngine.ts';
import { 
  Users, 
  Plus, 
  Search, 
  Building, 
  Phone, 
  Mail, 
  FileText, 
  CreditCard,
  Edit3,
  Trash2,
  CheckCircle,
  AlertCircle,
  BookUser
} from 'lucide-react';
import { pickContactFromPhonebook } from '../../utils/contactPicker.ts';
import { QuickContactModal } from '../../components/QuickContactModal.tsx';

export const PartiesView: React.FC = () => {
  const { parties, addParty, updateParty, deleteParty, invoices, purchases, payments } = useERP();

  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [partyType, setPartyType] = useState<PartyType>('SUPPLIER');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Gummidipoondi');
  const [stateCode, setStateCode] = useState('33');
  const [gstin, setGstin] = useState('');
  const [creditLimit, setCreditLimit] = useState(0);
  const [openingBalance, setOpeningBalance] = useState(0);

  const handleOpenAdd = () => {
    setEditingParty(null);
    const nextSeq = parties.length + 1;
    setCode(`PTY-26-${String(nextSeq).padStart(3, '0')}`);
    setName('');
    setTradeName('');
    setPartyType('SUPPLIER');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCity('Gummidipoondi');
    setStateCode('33');
    setGstin('');
    setCreditLimit(0);
    setOpeningBalance(0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Party) => {
    setEditingParty(p);
    setCode(p.partyCode);
    setName(p.legalName);
    setTradeName(p.tradeName || '');
    setPartyType(p.partyType);
    setContactPerson(p.contactPerson || '');
    setPhone(p.phone || '');
    setEmail(p.email || '');
    setAddress(p.addressLine1 || '');
    setCity(p.city || 'Gummidipoondi');
    setStateCode(p.stateCode || '33');
    setGstin(p.gstin || '');
    setCreditLimit(p.creditLimit || 0);
    setOpeningBalance(p.openingBalance || 0);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingParty) {
      updateParty(editingParty.id, {
        partyCode: code.trim().toUpperCase(),
        legalName: name.trim(),
        tradeName: tradeName.trim() || undefined,
        partyType,
        contactPerson,
        phone,
        email: email || undefined,
        addressLine1: address,
        city,
        stateName: stateCode === '33' ? 'Tamil Nadu' : 'Other State',
        stateCode,
        gstin: gstin.trim().toUpperCase() || undefined,
        creditLimit: Number(creditLimit),
        openingBalance: Number(openingBalance),
      });
      setFeedbackMsg({ type: 'success', text: `Party "${name}" updated successfully.` });
    } else {
      addParty({
        partyCode: code.trim().toUpperCase(),
        legalName: name.trim(),
        tradeName: tradeName.trim() || undefined,
        partyType,
        contactPerson,
        phone,
        email: email || undefined,
        addressLine1: address,
        city,
        stateName: stateCode === '33' ? 'Tamil Nadu' : 'Other State',
        stateCode,
        gstin: gstin.trim().toUpperCase() || undefined,
        paymentTerms: 'Immediate',
        creditLimit: Number(creditLimit),
        openingBalance: Number(openingBalance),
        openingBalanceDate: new Date().toISOString().split('T')[0],
        isActive: true,
      });
      setFeedbackMsg({ type: 'success', text: `New party "${name}" registered successfully.` });
    }

    setIsModalOpen(false);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleDeleteParty = (p: Party) => {
    if (confirm(`Are you sure you want to delete or deactivate party "${p.legalName}"?`)) {
      const res = deleteParty(p.id);
      if (res.success) {
        setFeedbackMsg({ type: 'success', text: res.message || `Party "${p.legalName}" removed.` });
      } else {
        setFeedbackMsg({ type: 'error', text: res.message || 'Failed to delete party.' });
      }
      setTimeout(() => setFeedbackMsg(null), 6000);
    }
  };

  const filteredParties = parties.filter((p) => {
    if (filterType !== 'ALL' && p.partyType !== filterType) return false;
    if (searchTerm) {
      const matchName = p.legalName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCode = p.partyCode.toLowerCase().includes(searchTerm.toLowerCase());
      return matchName || matchCode;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Suppliers & Customers Master</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Unified party master. A single entity can act as both supplier and customer with reconciled net ledger balance.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Party</span>
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

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 text-xs font-semibold">
          {['ALL', 'SUPPLIER', 'CUSTOMER', 'BOTH'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterType === type
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search party by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Parties List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Party Code</th>
                <th className="py-3 px-4">Legal Name</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">GSTIN / State</th>
                <th className="py-3 px-4 text-right">Credit Limit</th>
                <th className="py-3 px-4 text-right">Net Reconciled Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParties.map((party) => {
                const netBalance = calculatePartyNetBalance(party, invoices, purchases, payments);
                const isReceivable = netBalance > 0;
                const isPayable = netBalance < 0;

                return (
                  <tr key={party.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{party.partyCode}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{party.legalName}</span>
                      {party.tradeName && <span className="text-[10px] text-slate-500">t/a {party.tradeName}</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        party.partyType === 'BOTH' 
                          ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                          : party.partyType === 'CUSTOMER' 
                          ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {party.partyType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-800 font-medium block">{party.contactPerson}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{party.phone}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-slate-700 font-semibold block">{party.gstin || 'Unregistered'}</span>
                      <span className="text-[10px] text-slate-500">{party.stateName} ({party.stateCode})</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {party.creditLimit > 0 ? formatINR(party.creditLimit) : 'No Limit'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={isReceivable ? 'text-emerald-700' : isPayable ? 'text-rose-700' : 'text-slate-600'}>
                        {formatINR(Math.abs(netBalance))}
                      </span>
                      <span className="text-[9px] block text-slate-400 font-sans">
                        {isReceivable ? '(Receivable)' : isPayable ? '(Payable)' : '(Settled)'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={party.isActive ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedParty(party)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold"
                          title="View Ledger Statement"
                        >
                          Statement
                        </button>
                        <button
                          onClick={() => handleOpenEdit(party)}
                          className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Edit Party Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteParty(party)}
                          className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                          title="Delete / Deactivate Party"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Party Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingParty ? `Edit Party: ${editingParty.legalName}` : 'Register New Party (Supplier / Customer)'}
        subtitle="Unified business party identity with GSTIN and credit control."
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Party Code *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono uppercase"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Legal Business Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
                placeholder="e.g. Tejas Steel Traders Pvt Ltd"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Party Role *</label>
              <select
                value={partyType}
                onChange={(e) => setPartyType(e.target.value as any)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="SUPPLIER">Supplier Only (Scrap Purchase)</option>
                <option value="CUSTOMER">Customer Only (Scrap Sales)</option>
                <option value="BOTH">Both Supplier & Customer</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Contact Person</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">Phone / Mobile *</label>
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200 transition-colors cursor-pointer"
                  title="Pick directly from contacts, clipboard, or existing team"
                >
                  <BookUser className="w-3.5 h-3.5" />
                  <span>Fetch from Contacts</span>
                </button>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                placeholder="+91 98765 43210"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Address *</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">GSTIN Number</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono uppercase"
                placeholder="e.g. 33ADFPO6345L1ZA"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Credit Limit (₹)</label>
              <input
                type="number"
                value={creditLimit}
                onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                min="0"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Opening Balance (₹)</label>
              <input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                placeholder="+ for receivable, - for payable"
              />
            </div>
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
              Save Party Record
            </button>
          </div>
        </form>
      </Modal>

      {/* Party Statement Modal */}
      {selectedParty && (
        <Modal
          isOpen={!!selectedParty}
          onClose={() => setSelectedParty(null)}
          title={`Party Statement: ${selectedParty.legalName}`}
          subtitle={`Party Code: ${selectedParty.partyCode} · GSTIN: ${selectedParty.gstin || 'None'}`}
          maxWidth="4xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 block">Opening Balance</span>
                <span className="font-bold text-sm">{formatINR(selectedParty.openingBalance)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Payment Terms</span>
                <span className="font-bold">{selectedParty.paymentTerms}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Net Outstanding</span>
                <span className="font-bold text-sm text-red-600">
                  {formatINR(calculatePartyNetBalance(selectedParty, invoices, purchases, payments))}
                </span>
              </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl text-center text-slate-500 italic">
              All linked purchases, dispatches, and payment vouchers reconcile directly to source ledgers.
            </div>
          </div>
        </Modal>
      )}

      <QuickContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        title="Fetch Party / Client Contact"
        onSelect={(c) => {
          if (c.phone) setPhone(c.phone);
          if (c.name && (!contactPerson || !contactPerson.trim())) setContactPerson(c.name);
          if (c.name && (!name || !name.trim())) setName(c.name);
          if (c.email) setEmail(c.email);
          setFeedbackMsg({ type: 'success', text: `Fetched contact: ${c.name || c.phone}` });
          setTimeout(() => setFeedbackMsg(null), 3000);
        }}
      />
    </div>
  );
};
