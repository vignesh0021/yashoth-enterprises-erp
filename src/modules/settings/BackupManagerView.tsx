import React, { useState, useRef } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { googleDriveService } from '../../services/googleDriveService.ts';
import type { 
  BackupType, 
  BackupDestination, 
  BackupFrequency, 
  RestorePreviewResult 
} from '../../types/index.ts';
import { 
  Database, 
  Shield, 
  Download, 
  Upload, 
  Calendar, 
  Cloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  RefreshCw, 
  Eye, 
  History, 
  FileText,
  KeyRound,
  HardDrive,
  Check,
  AlertCircle
} from 'lucide-react';

export const BackupManagerView: React.FC = () => {
  const {
    activeCompany,
    currentUser,
    backupHistory,
    restoreLogs,
    backupSchedule,
    createBackup,
    previewRestore,
    executeSystemRestore,
    updateScheduleConfig,
    exportCsvRegister,
    syncPushToCloud,
    syncPullFromCloud,
  } = useERP();

  const [activeTab, setActiveTab] = useState<'EXPORT' | 'RESTORE' | 'HISTORY' | 'SCHEDULE'>('EXPORT');

  // Export Form State
  const [exportScope, setExportScope] = useState<'FULL' | 'COMPANY'>('FULL');
  const [encryptBackup, setEncryptBackup] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [exportDestination, setExportDestination] = useState<BackupDestination>('LOCAL_FILE');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);
  const [exportErrorMessage, setExportErrorMessage] = useState<string | null>(null);

  // Restore Wizard State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restorePreviewData, setRestorePreviewData] = useState<RestorePreviewResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'FULL' | 'COMPANY_SCOPED'>('FULL');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccessResult, setRestoreSuccessResult] = useState<{ records: number } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Google Drive State
  const [gdriveClientId, setGdriveClientId] = useState(googleDriveService.getClientId());
  const [gdriveStatus, setGdriveStatus] = useState(googleDriveService.getStatus());
  const [gdriveConnecting, setGdriveConnecting] = useState(false);
  const [gdriveMessage, setGdriveMessage] = useState<string | null>(null);

  // 3-Member Multi-Device Team Cloud Sync State
  const [isTeamSyncing, setIsTeamSyncing] = useState(false);
  const [teamSyncMsg, setTeamSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handlePushTeamSync = async () => {
    setIsTeamSyncing(true);
    setTeamSyncMsg(null);
    try {
      const res = await syncPushToCloud('yashothenterprises44@gmail.com');
      if (res.success) {
        setTeamSyncMsg({
          type: 'success',
          text: `Pushed whole ERP database to Team Cloud Hub (Revision ${res.revision}). All 3 devices with yashothenterprises44@gmail.com now share this identical data!`,
        });
      } else {
        setTeamSyncMsg({ type: 'error', text: res.error || 'Failed to sync to cloud hub.' });
      }
    } finally {
      setIsTeamSyncing(false);
    }
  };

  const handlePullTeamSync = async () => {
    setIsTeamSyncing(true);
    setTeamSyncMsg(null);
    try {
      const res = await syncPullFromCloud();
      if (res.success) {
        setTeamSyncMsg({
          type: 'success',
          text: `Pulled latest database from Cloud Hub (Revision ${res.revision || 1}) updated by ${res.syncedBy || 'team member'}. System updated with zero lag!`,
        });
      } else {
        setTeamSyncMsg({ type: 'error', text: res.error || 'Failed to pull latest cloud update.' });
      }
    } finally {
      setIsTeamSyncing(false);
    }
  };

  // Handle Export Generation
  const handleGenerateBackup = async () => {
    setExportErrorMessage(null);
    setExportSuccessMessage(null);

    if (encryptBackup) {
      if (!password || password.length < 6) {
        setExportErrorMessage('Encryption password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setExportErrorMessage('Password confirmation does not match.');
        return;
      }
    }

    setIsExporting(true);
    try {
      const result = await createBackup({
        companyScoped: exportScope === 'COMPANY',
        isEncrypted: encryptBackup,
        password: encryptBackup ? password : undefined,
        destination: exportDestination,
      });

      if (result.success) {
        if (result.error) {
          setExportSuccessMessage(
            `Backup generated & downloaded locally: ${result.filename}. (Notice: ${result.error})`
          );
        } else if (exportDestination === 'GOOGLE_DRIVE') {
          setExportSuccessMessage(
            `Backup generated successfully! File: ${result.filename}. Opened in Android "Save to Drive" / Share sheet & saved to device Downloads.`
          );
        } else {
          setExportSuccessMessage(
            `Backup generated successfully! File: ${result.filename} (SHA-256: ${result.checksum.slice(0, 16)}...)`
          );
        }
        setPassword('');
        setConfirmPassword('');
      } else {
        setExportErrorMessage(result.error || 'Failed to generate backup.');
      }
    } catch (err: any) {
      setExportErrorMessage(err.message || 'Error occurred during backup creation.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle File Upload for Restore
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setRestoreError(null);
    setRestorePreviewData(null);
    setRestoreSuccessResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setSelectedFileContent(content);
      // Auto trigger preview check
      triggerPreview(content, restorePassword);
    };
    reader.onerror = () => {
      setRestoreError('Failed to read backup file.');
    };
    reader.readAsText(file);
  };

  const triggerPreview = async (content: string, pwd?: string) => {
    setIsPreviewLoading(true);
    setRestoreError(null);
    try {
      const preview = await previewRestore(content, pwd);
      setRestorePreviewData(preview);
      if (!preview.isValid && preview.errors.length > 0) {
        setRestoreError(preview.errors.join(' '));
      }
    } catch (err: any) {
      setRestoreError(err.message || 'Failed to inspect backup file.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!selectedFileContent) return;
    setIsRestoring(true);
    setRestoreError(null);

    try {
      const res = await executeSystemRestore(selectedFileContent, restorePassword, restoreMode);
      if (res.success) {
        setRestoreSuccessResult({ records: res.recordsRestored });
        setShowPreviewModal(false);
        setSelectedFileContent(null);
        setSelectedFileName(null);
      } else {
        setRestoreError(res.error || 'Restoration failed.');
      }
    } catch (err: any) {
      setRestoreError(err.message || 'Restoration error.');
    } finally {
      setIsRestoring(false);
    }
  };

  // Google Drive Handlers
  const handleSaveGdriveClientId = () => {
    googleDriveService.setClientId(gdriveClientId);
    setGdriveStatus(googleDriveService.getStatus());
    setGdriveMessage('Google Client ID saved.');
    setTimeout(() => setGdriveMessage(null), 3000);
  };

  const handleConnectGoogleDrive = async () => {
    setGdriveConnecting(true);
    setGdriveMessage(null);
    const res = await googleDriveService.signIn();
    setGdriveConnecting(false);
    if (res.success) {
      setGdriveStatus(googleDriveService.getStatus());
      setGdriveMessage('Successfully connected to Google Drive!');
    } else {
      setGdriveMessage(`Connection failed: ${res.error}`);
    }
  };

  const handleDisconnectGoogleDrive = () => {
    googleDriveService.signOut();
    setGdriveStatus(googleDriveService.getStatus());
    setGdriveMessage('Disconnected Google Drive session.');
    setTimeout(() => setGdriveMessage(null), 3000);
  };

  // CSV Quick Download
  const handleDownloadCsv = (type: 'CUSTOMERS' | 'SUPPLIERS' | 'INVOICES' | 'PURCHASES' | 'EXPENSES' | 'STOCK') => {
    const csvStr = exportCsvRegister(type);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `YE_${activeCompany.code || 'COMP'}_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 gap-2 text-xs font-bold text-slate-600">
        <button
          onClick={() => setActiveTab('EXPORT')}
          className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-colors ${
            activeTab === 'EXPORT'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Generate Backup</span>
        </button>
        <button
          onClick={() => setActiveTab('RESTORE')}
          className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-colors ${
            activeTab === 'RESTORE'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Restore Wizard</span>
        </button>
        <button
          onClick={() => setActiveTab('SCHEDULE')}
          className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-colors ${
            activeTab === 'SCHEDULE'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Schedule & Cloud</span>
        </button>
        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-colors ${
            activeTab === 'HISTORY'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Backup History ({backupHistory.length})</span>
        </button>
      </div>

      {/* TAB 1: GENERATE BACKUP */}
      {activeTab === 'EXPORT' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5 text-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>Create System Backup Archive</span>
              </h3>
              <p className="text-slate-500 mt-1">
                Generates a cryptographically verified snapshot of operational records, journals, and company fixtures with SHA-256 integrity checksums.
              </p>
            </div>

            {exportSuccessMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span className="font-semibold break-all">{exportSuccessMessage}</span>
              </div>
            )}

            {exportErrorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="font-semibold">{exportErrorMessage}</span>
              </div>
            )}

            {/* Scope Selection */}
            <div className="space-y-2">
              <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Backup Scope
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExportScope('FULL')}
                  className={`p-3 rounded-lg border text-left flex flex-col justify-between ${
                    exportScope === 'FULL'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="font-bold flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-600" />
                    Full Database
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal mt-1">
                    Complete multi-company ERP database including all companies, entities, and audit logs.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope('COMPANY')}
                  className={`p-3 rounded-lg border text-left flex flex-col justify-between ${
                    exportScope === 'COMPANY'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="font-bold flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                    Company-Scoped
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal mt-1">
                    Isolated export of <strong className="text-slate-800">{activeCompany.companyName}</strong> records only.
                  </span>
                </button>
              </div>
            </div>

            {/* Destination Selection */}
            <div className="space-y-2">
              <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Destination
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 ${
                  exportDestination === 'LOCAL_FILE' ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-200'
                }`}>
                  <input
                    type="radio"
                    name="dest"
                    checked={exportDestination === 'LOCAL_FILE'}
                    onChange={() => setExportDestination('LOCAL_FILE')}
                    className="text-indigo-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Local Device Download</span>
                    <span className="text-[11px] text-slate-500">Save directly to local storage / filesystem.</span>
                  </div>
                </label>

                <label className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 ${
                  exportDestination === 'GOOGLE_DRIVE' ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-200'
                }`}>
                  <input
                    type="radio"
                    name="dest"
                    checked={exportDestination === 'GOOGLE_DRIVE'}
                    onChange={() => setExportDestination('GOOGLE_DRIVE')}
                    className="text-indigo-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-blue-600" />
                      Google Drive Cloud (Save to Drive)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Saves to device Downloads and opens Android 1-Tap "Save to Drive" with your account (yashothenterprises44@gmail.com).
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Encryption Option */}
            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/70 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-bold text-slate-900 block">AES-256-GCM Military Grade Encryption</span>
                    <span className="text-[11px] text-slate-500">
                      Derives cryptographic keys using PBKDF2 (100,000 rounds) and packages as an encrypted (.yebak) archive.
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={encryptBackup}
                  onChange={(e) => setEncryptBackup(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
              </div>

              {encryptBackup && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Encryption Password (Min 6 chars)
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isExporting}
                onClick={handleGenerateBackup}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Encrypting & Generating Archive...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download {encryptBackup ? 'Encrypted (.yebak)' : 'JSON'} Backup Snapshot</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Tabular CSV / Excel Exports Panel */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 text-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Spreadsheet / CSV Registers</span>
              </h3>
              <p className="text-slate-500 mt-1">
                Download isolated CSV workbooks for external accounting and audit reconciliation.
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleDownloadCsv('CUSTOMERS')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <span className="font-semibold">Customers Register</span>
                <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1">
                  <Download className="w-3 h-3" /> CSV
                </span>
              </button>
              <button
                onClick={() => handleDownloadCsv('SUPPLIERS')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <span className="font-semibold">Suppliers Register</span>
                <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1">
                  <Download className="w-3 h-3" /> CSV
                </span>
              </button>
              <button
                onClick={() => handleDownloadCsv('INVOICES')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <span className="font-semibold">Sales Invoice Register</span>
                <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1">
                  <Download className="w-3 h-3" /> CSV
                </span>
              </button>
              <button
                onClick={() => handleDownloadCsv('PURCHASES')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <span className="font-semibold">Purchase Inward Register</span>
                <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1">
                  <Download className="w-3 h-3" /> CSV
                </span>
              </button>
              <button
                onClick={() => handleDownloadCsv('EXPENSES')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <span className="font-semibold">Expense Vouchers Register</span>
                <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1">
                  <Download className="w-3 h-3" /> CSV
                </span>
              </button>
              <button
                onClick={() => handleDownloadCsv('STOCK')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <span className="font-semibold">Inventory Valuation Register</span>
                <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1">
                  <Download className="w-3 h-3" /> CSV
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESTORE WIZARD */}
      {activeTab === 'RESTORE' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-3xl space-y-6 text-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>Safe Database Restoration Wizard</span>
            </h3>
            <p className="text-slate-500 mt-1">
              Inspect, preview, and restore database archives. An automated pre-restore safety snapshot will always be captured prior to applying updates.
            </p>
          </div>

          {restoreSuccessResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Restoration Completed Successfully!</span>
              </div>
              <p className="text-[11px] text-emerald-800">
                A total of {restoreSuccessResult.records} records were restored into the system. An automatic safety snapshot was preserved in backup history.
              </p>
            </div>
          )}

          {restoreError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="font-semibold">{restoreError}</span>
            </div>
          )}

          {/* File Picker */}
          <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json,.yebak"
              className="hidden"
            />
            <Upload className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
            <span className="font-bold text-slate-800 block text-sm">
              {selectedFileName ? selectedFileName : 'Choose or Drop Backup Archive (.json or .yebak)'}
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">
              Supports standard plaintext JSON backups and AES-256-GCM encrypted .yebak archives.
            </span>
          </div>

          {/* If file is selected */}
          {selectedFileContent && (
            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-600" />
                  Loaded: {selectedFileName}
                </span>
                <span className="text-[11px] text-slate-500">
                  Size: {(selectedFileContent.length / 1024).toFixed(1)} KB
                </span>
              </div>

              {/* Password prompt if encrypted */}
              {selectedFileContent.includes('"isEncrypted":true') && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Archive is AES-256-GCM Encrypted</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Enter decryption password"
                      value={restorePassword}
                      onChange={(e) => setRestorePassword(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-amber-300 rounded-lg text-xs bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => triggerPreview(selectedFileContent, restorePassword)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold"
                    >
                      Decrypt & Verify
                    </button>
                  </div>
                </div>
              )}

              {/* Validation & Preview Badge */}
              {isPreviewLoading && (
                <div className="flex items-center gap-2 text-slate-500 py-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Calculating SHA-256 integrity checksum & parsing payload...</span>
                </div>
              )}

              {restorePreviewData && restorePreviewData.isValid && (
                <div className="space-y-4 pt-2 border-t border-slate-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <span className="text-slate-400 block text-[10px] uppercase">Archive Type</span>
                      <span className="font-bold text-slate-800">{restorePreviewData.manifest.type}</span>
                    </div>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <span className="text-slate-400 block text-[10px] uppercase">Schema Version</span>
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> v{restorePreviewData.schemaVersion}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <span className="text-slate-400 block text-[10px] uppercase">Total Records</span>
                      <span className="font-bold text-indigo-600">
                        {Object.values(restorePreviewData.recordCounts).reduce((a, b) => a + b, 0)} records
                      </span>
                    </div>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <span className="text-slate-400 block text-[10px] uppercase">Integrity SHA-256</span>
                      <span className="font-bold text-emerald-700 font-mono text-[10px]">
                        {restorePreviewData.manifest.sha256.slice(0, 10)}... VERIFIED
                      </span>
                    </div>
                  </div>

                  {restorePreviewData.warnings.length > 0 && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] space-y-1">
                      {restorePreviewData.warnings.map((w, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPreviewModal(true)}
                      className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg font-bold text-slate-700 flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Entity Breakdown</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteRestore}
                      disabled={isRestoring}
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-sm flex items-center justify-center gap-2"
                    >
                      {isRestoring ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Executing Safety Backup & Restoring...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Execute Full Restore ({restoreMode})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SCHEDULE & CLOUD */}
      {activeTab === 'SCHEDULE' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Automated Schedule Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>Automated Backup Scheduling</span>
              </h3>
              <p className="text-slate-500 mt-1">
                Configure recurrent backups. Scheduled backups execute automatically during active application sessions.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                <span className="font-semibold text-slate-800">Enable Automated Schedule</span>
                <input
                  type="checkbox"
                  checked={backupSchedule.isEnabled}
                  onChange={(e) => updateScheduleConfig({ isEnabled: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Backup Frequency</label>
                <select
                  value={backupSchedule.frequency}
                  onChange={(e) => updateScheduleConfig({ frequency: e.target.value as BackupFrequency })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="MANUAL_ONLY">Manual Only (Disabled)</option>
                  <option value="DAILY">Daily (Every 24 Hours)</option>
                  <option value="WEEKLY">Weekly (Every 7 Days)</option>
                  <option value="MONTHLY">Monthly (Every 30 Days)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Retention Count</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={backupSchedule.retentionCount}
                    onChange={(e) => updateScheduleConfig({ retentionCount: parseInt(e.target.value) || 10 })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Auto-Encryption</label>
                  <label className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      checked={backupSchedule.encryptByDefault}
                      onChange={(e) => updateScheduleConfig({ encryptByDefault: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="text-slate-600">Encrypt with AES</span>
                  </label>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Run:</span>
                  <span className="font-semibold text-slate-800">
                    {backupSchedule.lastRunAt ? new Date(backupSchedule.lastRunAt).toLocaleString() : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Next Scheduled Run:</span>
                  <span className="font-semibold text-indigo-700">
                    {backupSchedule.nextRunAt ? new Date(backupSchedule.nextRunAt).toLocaleString() : 'Not Scheduled'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Google Drive Integration Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-600" />
                <span>Google Drive Cloud Integration</span>
              </h3>
              <p className="text-slate-500 mt-1">
                Export encrypted or standard system backups directly to Google Drive via Android 1-Tap Save to Drive or Web OAuth.
              </p>
            </div>

            {/* Android Native 1-Tap Notice */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Android Native 1-Tap Google Drive Active</span>
              </div>
              <p className="text-emerald-800 text-[11px] leading-relaxed">
                When generating a backup with destination <strong>"Google Drive Cloud"</strong>, the ERP automatically saves the file to your phone's <strong>Downloads</strong> folder and opens Android's native <strong>"Save to Drive"</strong> window using your connected Google account (<strong className="underline">yashothenterprises44@gmail.com</strong>).
              </p>
            </div>

            {gdriveMessage && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 font-semibold text-[11px]">
                {gdriveMessage}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Google Cloud Web Client ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 123456789-xxxx.apps.googleusercontent.com"
                    value={gdriveClientId}
                    onChange={(e) => setGdriveClientId(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSaveGdriveClientId}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold"
                  >
                    Save
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Public Client ID only. No client secret is required or accepted in frontend code.
                </span>
              </div>

              <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">Connection Status</span>
                  <span className={`text-[11px] font-semibold ${
                    gdriveStatus.isConnected ? 'text-emerald-700' : 'text-slate-500'
                  }`}>
                    {gdriveStatus.isConnected ? 'Connected to Google Drive' : 'Disconnected / Token Expired'}
                  </span>
                </div>
                {gdriveStatus.isConnected ? (
                  <button
                    onClick={handleDisconnectGoogleDrive}
                    className="px-3 py-1.5 border border-rose-300 hover:bg-rose-50 text-rose-700 rounded-lg font-bold"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    disabled={gdriveConnecting}
                    onClick={handleConnectGoogleDrive}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>{gdriveConnecting ? 'Connecting...' : 'Connect Drive'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3-Member Shared Team Cloud Vault Card */}
          <div className="md:col-span-2 bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 rounded-xl border border-indigo-800 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-800/80 pb-3">
              <div>
                <h3 className="text-sm font-black flex items-center gap-2 text-white">
                  <Cloud className="w-5 h-5 text-sky-400" />
                  <span>Option 3: 3-Member Zero-Lag Shared Cloud Sync</span>
                </h3>
                <p className="text-[11px] text-indigo-200 mt-0.5">
                  Single email (<strong className="text-amber-300">yashothenterprises44@gmail.com</strong>) used across 3 devices. Backup once and all 3 members see identical live data instantly with zero lag.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 self-start sm:self-auto">
                Shared Hub Active
              </span>
            </div>

            {teamSyncMsg && (
              <div
                className={`p-3 rounded-lg border text-xs font-semibold ${
                  teamSyncMsg.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                    : 'bg-rose-950/80 border-rose-500 text-rose-200'
                }`}
              >
                {teamSyncMsg.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-indigo-300 block font-semibold">Shared Email Identity</span>
                <span className="font-bold text-white block mt-0.5 font-mono">yashothenterprises44@gmail.com</span>
                <span className="text-[10px] text-slate-400">All 3 staff members</span>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-indigo-300 block font-semibold">Master Sync Vault ID</span>
                <span className="font-mono text-emerald-300 font-bold block mt-0.5 truncate">ff808181...7de2</span>
                <span className="text-[10px] text-slate-400">api.restful-api.dev</span>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-indigo-300 block font-semibold">Sync Mode</span>
                <span className="font-bold text-sky-300 block mt-0.5">Instant Multi-Device Hub</span>
                <span className="text-[10px] text-slate-400">No email popups required</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handlePushTeamSync}
                disabled={isTeamSyncing}
                className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-sm cursor-pointer transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${isTeamSyncing ? 'animate-spin' : ''}`} />
                <span>Push Local Changes to Team Cloud</span>
              </button>

              <button
                onClick={handlePullTeamSync}
                disabled={isTeamSyncing}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/30 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 border border-white/20 cursor-pointer transition-all"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Pull Latest Updates from Team Cloud</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BACKUP HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-6 text-xs">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <span>Cryptographic Backup Audit Trail</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200">
                    <th className="p-2.5">Archive Name / ID</th>
                    <th className="p-2.5">Scope</th>
                    <th className="p-2.5">Destination</th>
                    <th className="p-2.5">Size</th>
                    <th className="p-2.5">SHA-256 Hash</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Generated At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {backupHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-slate-400">
                        No previous backups recorded.
                      </td>
                    </tr>
                  ) : (
                    backupHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2.5">
                          <span className="font-bold text-slate-800 block">{item.backupName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.id}</span>
                        </td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.backupType === 'FULL_DATABASE'
                              ? 'bg-indigo-100 text-indigo-800'
                              : item.backupType === 'SAFETY_PRE_RESTORE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {item.backupType}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600 font-medium">
                          {item.destination}
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {(item.fileSizeBytes / 1024).toFixed(1)} KB
                        </td>
                        <td className="p-2.5">
                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700" title={item.sha256Checksum}>
                            {item.sha256Checksum.slice(0, 12)}...
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {item.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-500 whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Restoration Logs */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              <span>Restoration Audit Logs</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200">
                    <th className="p-2.5">Restore ID</th>
                    <th className="p-2.5">Restored By</th>
                    <th className="p-2.5">Pre-Restore Snapshot ID</th>
                    <th className="p-2.5">Records Restored</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {restoreLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">
                        No restoration operations recorded.
                      </td>
                    </tr>
                  ) : (
                    restoreLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-slate-800">{log.id}</td>
                        <td className="p-2.5 text-slate-700 font-medium">{log.restoredBy}</td>
                        <td className="p-2.5 font-mono text-slate-500 text-[10px]">{log.preRestoreBackupId}</td>
                        <td className="p-2.5 text-indigo-700 font-bold">
                          {Object.values(log.recordsRestoredJson).reduce((a, b) => a + b, 0)} records
                        </td>
                        <td className="p-2.5 text-emerald-700 font-bold">{log.status}</td>
                        <td className="p-2.5 text-slate-500 whitespace-nowrap">
                          {new Date(log.restoredAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Restore Preview Modal */}
      {showPreviewModal && restorePreviewData && (
        <Modal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          title="Backup Archive Content Inspection"
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <span className="font-bold text-slate-800 block text-sm">
                {restorePreviewData.manifest.companyName || 'Multi-Company Archive'}
              </span>
              <span className="text-slate-500 block">
                Generated: {new Date(restorePreviewData.manifest.generatedAt).toLocaleString()} by {restorePreviewData.manifest.actor}
              </span>
              <span className="font-mono text-[10px] text-slate-400 block break-all">
                SHA-256: {restorePreviewData.manifest.sha256}
              </span>
            </div>

            <div>
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] block mb-2">
                Entity Record Counts
              </span>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(restorePreviewData.recordCounts).map(([entity, count]) => (
                  <div key={entity} className="p-2 border border-slate-200 rounded-lg bg-white flex justify-between">
                    <span className="text-slate-600 capitalize">{entity}:</span>
                    <span className="font-bold text-indigo-700">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] block mb-2">
                Financial Reconciliation Metrics
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-emerald-700 block text-[10px]">Total Sales Revenue:</span>
                  <span className="font-bold text-emerald-900">
                    ₹{(restorePreviewData.financialTotals.totalSales || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-blue-700 block text-[10px]">Total Purchases Inward:</span>
                  <span className="font-bold text-blue-900">
                    ₹{(restorePreviewData.financialTotals.totalPurchases || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                  <span className="text-purple-700 block text-[10px]">Total Payments:</span>
                  <span className="font-bold text-purple-900">
                    ₹{(restorePreviewData.financialTotals.totalPayments || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg">
                  <span className="text-rose-700 block text-[10px]">Total Expenses:</span>
                  <span className="font-bold text-rose-900">
                    ₹{(restorePreviewData.financialTotals.totalExpenses || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
