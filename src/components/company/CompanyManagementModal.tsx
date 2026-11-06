import React, { useState } from 'react';
import { Building2, Plus, Edit2, CheckCircle2, ShieldCheck, X, AlertTriangle, FileText, Landmark } from 'lucide-react';
import { useERP } from '../../context/ERPContext.tsx';
import type { CompanyRegistrationInput } from '../../../backend/business-rules/companyEngine.ts';
import type { Company } from '../../types/index.ts';

interface CompanyManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'SWITCH' | 'REGISTER' | 'EDIT';
}

export const CompanyManagementModal: React.FC<CompanyManagementModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'SWITCH',
}) => {
  const { companies, activeCompanyId, switchCompany, registerCompany, updateCompany, currentUser } = useERP();
  const [tab, setTab] = useState<'SWITCH' | 'REGISTER' | 'EDIT'>(initialTab);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) || companies[0];

  // Registration Form State
  const [regForm, setRegForm] = useState<CompanyRegistrationInput>({
    code: '',
    name: '',
    legalName: '',
    tradeName: '',
    gstin: '',
    phone: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    city: 'Gummidipoondi',
    stateName: 'Tamil Nadu',
    stateCode: '33',
    pincode: '601206',
    bankName: '',
    bankAccountNo: '',
    bankBranch: '',
    bankBranchIfsc: '',
    invoicePrefix: '',
    purchasePrefix: '',
    quotationPrefix: '',
    defaultBaseUnit: 'KG',
    currency: 'INR',
  });

  // Edit Form State (initialized from activeCompany)
  const [editForm, setEditForm] = useState<Partial<Company>>({
    name: activeCompany?.name || '',
    legalName: activeCompany?.legalName || '',
    tradeName: activeCompany?.tradeName || '',
    gstin: activeCompany?.gstin || '',
    pan: activeCompany?.pan || '',
    phone: activeCompany?.phone || '',
    email: activeCompany?.email || '',
    addressLine1: activeCompany?.addressLine1 || '',
    addressLine2: activeCompany?.addressLine2 || '',
    city: activeCompany?.city || '',
    pincode: activeCompany?.pincode || '',
    bankName: activeCompany?.bankName || '',
    bankAccountNo: activeCompany?.bankAccountNo || '',
    bankBranch: activeCompany?.bankBranch || '',
    bankBranchIfsc: activeCompany?.bankBranchIfsc || '',
    invoicePrefix: activeCompany?.invoicePrefix || '',
    purchasePrefix: activeCompany?.purchasePrefix || '',
  });

  if (!isOpen) return null;

  const handleSwitch = (companyId: string) => {
    try {
      setError(null);
      switchCompany(companyId);
      setSuccess(`Switched active company to "${companies.find((c) => c.id === companyId)?.name}".`);
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 700);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to switch company');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const created = registerCompany(regForm);
      setSuccess(`Company "${created.name}" registered successfully!`);
      // Reset form
      setRegForm({
        code: '',
        name: '',
        legalName: '',
        tradeName: '',
        gstin: '',
        phone: '',
        email: '',
        addressLine1: '',
        addressLine2: '',
        city: 'Gummidipoondi',
        stateName: 'Tamil Nadu',
        stateCode: '33',
        pincode: '601206',
        bankName: '',
        bankAccountNo: '',
        bankBranch: '',
        bankBranchIfsc: '',
        invoicePrefix: '',
        purchasePrefix: '',
        quotationPrefix: '',
        defaultBaseUnit: 'KG',
        currency: 'INR',
      });
      setTimeout(() => {
        switchCompany(created.id);
        setSuccess(null);
        setTab('SWITCH');
      }, 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      updateCompany(activeCompany.id, editForm);
      setSuccess(`Company profile updated successfully.`);
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600 rounded-xl">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Multi-Company Management</h2>
              <p className="text-xs text-slate-400">
                Active Entity: <span className="text-white font-semibold">{activeCompany.name}</span> ({activeCompany.code})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 px-6 pt-3 bg-slate-50 gap-2">
          <button
            onClick={() => { setTab('SWITCH'); setError(null); setSuccess(null); }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'SWITCH'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Entities ({companies.length})</span>
          </button>
          <button
            onClick={() => { setTab('EDIT'); setError(null); setSuccess(null); }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'EDIT'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit Profile</span>
          </button>
          <button
            onClick={() => { setTab('REGISTER'); setError(null); setSuccess(null); }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'REGISTER'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>+ Register Sister Firm</span>
          </button>
        </div>

        {/* Alerts */}
        <div className="px-6 pt-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'SWITCH' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-2">
                Select an active business entity. Invoices, scrap stock, purchases, and bank accounts will automatically be scoped to the chosen firm.
              </p>
              {companies.map((comp) => {
                const isCurrent = comp.id === activeCompanyId;
                return (
                  <div
                    key={comp.id}
                    onClick={() => handleSwitch(comp.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isCurrent
                        ? 'border-red-500 bg-red-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{comp.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-200 text-slate-700">
                          {comp.code}
                        </span>
                        {comp.isDefault && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Primary Company
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 font-mono">
                        GSTIN: <span className="font-semibold text-slate-900">{comp.gstin}</span> · Prefix: <span className="font-semibold">{comp.invoicePrefix}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {comp.addressLine1}, {comp.city} — {comp.bankName} ({comp.bankAccountNo})
                      </div>
                    </div>
                    <div>
                      {isCurrent ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Active</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
                        >
                          Switch To
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'EDIT' && (
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Commercial Name</label>
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Legal Registered Name</label>
                  <input
                    type="text"
                    value={editForm.legalName || ''}
                    onChange={(e) => setEditForm({ ...editForm, legalName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={editForm.gstin || ''}
                    onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono"
                    maxLength={15}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={editForm.pan || ''}
                    onChange={(e) => setEditForm({ ...editForm, pan: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email || ''}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Address</label>
                  <input
                    type="text"
                    value={editForm.addressLine1 || ''}
                    onChange={(e) => setEditForm({ ...editForm, addressLine1: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={editForm.city || ''}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    value={editForm.pincode || ''}
                    onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={editForm.bankName || ''}
                    onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Account Number</label>
                  <input
                    type="text"
                    value={editForm.bankAccountNo || ''}
                    onChange={(e) => setEditForm({ ...editForm, bankAccountNo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Branch & IFSC</label>
                  <input
                    type="text"
                    value={editForm.bankBranchIfsc || ''}
                    onChange={(e) => setEditForm({ ...editForm, bankBranchIfsc: e.target.value, bankBranch: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Prefix (e.g. YE/)</label>
                  <input
                    type="text"
                    value={editForm.invoicePrefix || ''}
                    onChange={(e) => setEditForm({ ...editForm, invoicePrefix: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          )}

          {tab === 'REGISTER' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <strong>Register a Sister Concern or Branch:</strong> This will establish an isolated company ledger with its own GSTIN, bank accounts, and invoice series under your ERP.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. YE-LOGISTICS"
                    value={regForm.code}
                    onChange={(e) => setRegForm({ ...regForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Entity Trade Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Yashoth Logistics"
                    value={regForm.name}
                    onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Legal Name</label>
                  <input
                    type="text"
                    placeholder="e.g. YASHOTH LOGISTICS PVT LTD"
                    value={regForm.legalName}
                    onChange={(e) => setRegForm({ ...regForm, legalName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN (15 chars) *</label>
                  <input
                    type="text"
                    placeholder="33AABCL1234F1Z1"
                    value={regForm.gstin}
                    onChange={(e) => setRegForm({ ...regForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono"
                    maxLength={15}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone *</label>
                  <input
                    type="text"
                    placeholder="+91 94440 00000"
                    value={regForm.phone}
                    onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email *</label>
                  <input
                    type="email"
                    placeholder="accounts@yasoth.com"
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Address *</label>
                  <input
                    type="text"
                    placeholder="Street / Yard Address"
                    value={regForm.addressLine1}
                    onChange={(e) => setRegForm({ ...regForm, addressLine1: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    value={regForm.city}
                    onChange={(e) => setRegForm({ ...regForm, city: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pincode *</label>
                  <input
                    type="text"
                    value={regForm.pincode}
                    onChange={(e) => setRegForm({ ...regForm, pincode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. STATE BANK OF INDIA"
                    value={regForm.bankName}
                    onChange={(e) => setRegForm({ ...regForm, bankName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Account No *</label>
                  <input
                    type="text"
                    placeholder="Account Number"
                    value={regForm.bankAccountNo}
                    onChange={(e) => setRegForm({ ...regForm, bankAccountNo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Branch *</label>
                  <input
                    type="text"
                    placeholder="e.g. GUMMIDIPOODI SIPCOT"
                    value={regForm.bankBranch}
                    onChange={(e) => setRegForm({ ...regForm, bankBranch: e.target.value, bankBranchIfsc: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Prefix *</label>
                  <input
                    type="text"
                    placeholder="e.g. YL/"
                    value={regForm.invoicePrefix}
                    onChange={(e) => setRegForm({ ...regForm, invoicePrefix: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono uppercase"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setTab('SWITCH')}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Register & Create Company
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
