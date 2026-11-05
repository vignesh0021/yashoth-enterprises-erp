import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { 
  Settings, 
  Building, 
  Shield, 
  Upload, 
  Download, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  Database 
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { 
    company, 
    updateCompanySettings, 
    currentUser, 
    importParties, 
    importOpeningStock, 
    exportBackup, 
    restoreBackup, 
    resetToDemoData 
  } = useERP();

  const [activeTab, setActiveTab] = useState<'PROFILE' | 'ROLES' | 'MIGRATION' | 'BACKUP'>('PROFILE');

  // Company Profile Form State
  const [companyName, setCompanyName] = useState(company.companyName);
  const [address1, setAddress1] = useState(company.addressLine1);
  const [address2, setAddress2] = useState(company.addressLine2);
  const [city, setCity] = useState(company.city);
  const [gstin, setGstin] = useState(company.gstin);
  const [phone, setPhone] = useState(company.phone);
  const [email, setEmail] = useState(company.email);
  const [bankName, setBankName] = useState(company.bankName);
  const [bankAcc, setBankAcc] = useState(company.bankAccountNo);
  const [bankIfsc, setBankIfsc] = useState(company.bankBranchIfsc);
  const [prefix, setPrefix] = useState(company.invoicePrefix);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Migration Wizard State
  const [migrationType, setMigrationType] = useState<'PARTIES' | 'STOCK'>('PARTIES');
  const [csvText, setCsvText] = useState(
    'party_code,legal_name,party_type,phone,opening_balance\n' +
    'SUP-EXCEL-01,Madras Alloys Pvt Ltd,SUPPLIER,+91 94440 99881,-25000\n' +
    'CUST-EXCEL-01,Kaveri Foundry Works,CUSTOMER,+91 98401 22334,60000'
  );
  const [migrationReport, setMigrationReport] = useState<any | null>(null);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompanySettings({
      companyName,
      addressLine1: address1,
      addressLine2: address2,
      city,
      gstin,
      phone,
      email,
      bankName,
      bankAccountNo: bankAcc,
      bankBranchIfsc: bankIfsc,
      invoicePrefix: prefix,
    });
    setProfileSuccess(true);
    setTimeout(() => setProfileSuccess(false), 3000);
  };

  const parseCsvText = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim());
      const row: Record<string, any> = {};
      headers.forEach((h, i) => {
        row[h] = values[i];
      });
      return row;
    });
  };

  const handleMigrationDryRun = () => {
    const rows = parseCsvText(csvText);
    if (migrationType === 'PARTIES') {
      const report = importParties(rows, true);
      setMigrationReport(report);
    } else {
      const report = importOpeningStock(rows, true);
      setMigrationReport(report);
    }
  };

  const handleMigrationCommit = () => {
    const rows = parseCsvText(csvText);
    if (migrationType === 'PARTIES') {
      const report = importParties(rows, false);
      setMigrationReport(report);
    } else {
      const report = importOpeningStock(rows, false);
      setMigrationReport(report);
    }
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Yasoth_ERP_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight">System Settings & Data Migration</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure company profile, invoice numbering, RBAC security roles, and migrate legacy Excel registers safely.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-semibold">
        {[
          { id: 'PROFILE', label: 'Company & Tax Profile', icon: Building },
          { id: 'ROLES', label: 'Role-Based Access Control', icon: Shield },
          { id: 'MIGRATION', label: 'Data Migration Wizard', icon: Upload },
          { id: 'BACKUP', label: 'Backup & Restore', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Profile Tab */}
      {activeTab === 'PROFILE' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-4xl">
          {profileSuccess && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Company and invoice letterhead settings updated successfully!</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4 text-xs">
            <h3 className="font-bold text-slate-900 text-sm">Official Letterhead & Invoice Details</h3>

            {/* Official Logo Display */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-4">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-center">
                <img
                  src="/yasoth-logo.png"
                  alt="Yasoth Enterprises Logo"
                  className="h-16 w-auto object-contain"
                />
              </div>
              <div>
                <span className="font-black text-sm text-slate-900 block">Official Logo & Corporate Brand Identity</span>
                <span className="text-xs text-slate-600 block mt-0.5">
                  Authoritative high-resolution red-wing emblem extracted from TEJAS Invoice Template. Featured across GST Tax Invoices, Weighbridge Slips, and Dashboard.
                </span>
                <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                  File: /public/yasoth-logo.png · Format: High-Res PNG
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Company Trade Name *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">GSTIN (State Code 33 - Tamil Nadu) *</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono uppercase"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Address Line 1 *</label>
                <input
                  type="text"
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Address Line 2 (Junction / Area)</label>
                <input
                  type="text"
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">City & District *</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Invoice Number Prefix *</label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                  placeholder="e.g. YE/"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Official Contact Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Official E-Mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <h3 className="font-bold text-slate-900 text-sm pt-4 border-t border-slate-100">
              Settlement Bank Profile (Printed on Invoices)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Current A/c Number</label>
                <input
                  type="text"
                  value={bankAcc}
                  onChange={(e) => setBankAcc(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Branch & IFS Code</label>
                <input
                  type="text"
                  value={bankIfsc}
                  onChange={(e) => setBankIfsc(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm"
              >
                Save Settings
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Migration Wizard Tab */}
      {activeTab === 'MIGRATION' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 max-w-4xl text-xs">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px]">
            <p className="font-bold">Controlled Migration from Excel / Paper Registers:</p>
            <p className="mt-0.5">
              1. Paste CSV content below. 2. Click "Run Dry-Run Validation". 3. Review errors and reconciliation summary. 4. Click "Commit Import" to safely add records.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-700">Target Import Entity:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="migType"
                checked={migrationType === 'PARTIES'}
                onChange={() => {
                  setMigrationType('PARTIES');
                  setCsvText(
                    'party_code,legal_name,party_type,phone,opening_balance\n' +
                    'SUP-EXCEL-01,Madras Alloys Pvt Ltd,SUPPLIER,+91 94440 99881,-25000\n' +
                    'CUST-EXCEL-01,Kaveri Foundry Works,CUSTOMER,+91 98401 22334,60000'
                  );
                  setMigrationReport(null);
                }}
              />
              <span>Parties Master (Suppliers/Customers)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="migType"
                checked={migrationType === 'STOCK'}
                onChange={() => {
                  setMigrationType('STOCK');
                  setCsvText(
                    'material_code,yard_code,quantity,unit_cost\n' +
                    'MAT-MS-BORING,YARD-01,12000,28.00\n' +
                    'MAT-HMS1,YARD-01,6500,33.50'
                  );
                  setMigrationReport(null);
                }}
              />
              <span>Verified Opening Stock Lots</span>
            </label>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">CSV Data Input</label>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg font-mono text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleMigrationDryRun}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm"
            >
              Run Dry-Run Validation
            </button>
            <button
              onClick={handleMigrationCommit}
              disabled={!migrationReport || migrationReport.errors.length > 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-sm"
            >
              Commit Import into Database
            </button>
          </div>

          {migrationReport && (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{migrationReport.summaryNote}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  migrationReport.errors.length === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {migrationReport.errors.length} Issues Found
                </span>
              </div>

              {migrationReport.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {migrationReport.errors.map((err: any, idx: number) => (
                    <div key={idx} className="text-rose-700 text-[11px] flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Row {err.rowNumber} [{err.field}]: {err.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Backup & Restore Tab */}
      {activeTab === 'BACKUP' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-2xl space-y-5 text-xs">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">System Backup & Recovery</h3>
            <p className="text-slate-500 mt-1">
              Download complete database snapshots including all posted transactions, weighment slips, invoices, and audit logs.
            </p>
          </div>

          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-800 block">Export Full JSON Snapshot</span>
              <span className="text-[11px] text-slate-500">Download complete ERP state for safe cold storage.</span>
            </div>
            <button
              onClick={handleDownloadBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Backup</span>
            </button>
          </div>

          <div className="p-4 border border-rose-200 rounded-xl bg-rose-50/50 flex items-center justify-between">
            <div>
              <span className="font-bold text-rose-900 block">Reset to Factory Fixtures</span>
              <span className="text-[11px] text-rose-700">Restore default demo dataset and clear local changes.</span>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Reset ERP state to verified initial fixtures?')) {
                  resetToDemoData();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset State</span>
            </button>
          </div>
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === 'ROLES' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-4xl text-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Role-Based Access Control (RBAC) Matrix</h3>
          <p className="text-slate-500">
            Authorization is enforced on business operations. Ordinary operators cannot delete posted records or bypass approvals.
          </p>

          <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden border-collapse">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-slate-200 text-[10px] uppercase">
                <th className="p-2.5">Action / Operation</th>
                <th className="p-2.5">Operator</th>
                <th className="p-2.5">Yard Manager</th>
                <th className="p-2.5">Owner / Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-2.5 font-semibold">Enter Purchase / Collection</td>
                <td className="p-2.5 text-slate-600">Create Draft</td>
                <td className="p-2.5 text-slate-600">Review & Verify</td>
                <td className="p-2.5 font-bold text-emerald-700">Full Access</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold">Post Stock Inward</td>
                <td className="p-2.5 text-rose-600">Restricted</td>
                <td className="p-2.5 font-semibold text-emerald-700">Approved Limits</td>
                <td className="p-2.5 font-bold text-emerald-700">Full Access</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold">Post Stock Count Reconciliation</td>
                <td className="p-2.5 text-slate-600">Request Only</td>
                <td className="p-2.5 font-semibold text-emerald-700">Approve Adjustment</td>
                <td className="p-2.5 font-bold text-emerald-700">Full Access</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold">Record Payment Voucher</td>
                <td className="p-2.5 text-slate-600">Draft Entry</td>
                <td className="p-2.5 font-semibold text-emerald-700">Verify & Approve</td>
                <td className="p-2.5 font-bold text-emerald-700">Full Access</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold">Modify Opening Balances</td>
                <td className="p-2.5 text-rose-600">Forbidden</td>
                <td className="p-2.5 text-rose-600">Forbidden</td>
                <td className="p-2.5 font-bold text-emerald-700">Owner Only with Audit</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
