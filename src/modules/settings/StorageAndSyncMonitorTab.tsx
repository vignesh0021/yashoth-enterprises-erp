import React, { useState, useMemo } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { offlineSyncService } from '../../services/offlineSyncService.ts';
import {
  HardDrive,
  Database,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  UploadCloud,
  RotateCcw,
  Wifi,
  WifiOff,
  FileArchive,
} from 'lucide-react';

function fmtBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const StorageAndSyncMonitorTab: React.FC = () => {
  const {
    activeCompanyId,
    backupHistory,
    restoreLogs,
    uploadedDocuments,
    getStorageMonitorSnapshot,
    migrateLegacyDocumentsToDrive,
    rollbackLastDocumentMigration,
    currentUser,
  } = useERP();

  const [migrationMsg, setMigrationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const snapshot = useMemo(() => getStorageMonitorSnapshot(), [getStorageMonitorSnapshot, refreshTick]);
  const telemetry = useMemo(() => offlineSyncService.getFullTelemetry(activeCompanyId), [activeCompanyId, refreshTick]);
  const conflicts = useMemo(
    () => offlineSyncService.getConflictLogs(activeCompanyId).filter((c) => !c.resolved),
    [activeCompanyId, refreshTick]
  );

  const legacyBase64Count = uploadedDocuments.filter((d) => d.fileDataUrl && d.fileDataUrl.length > 256).length;
  const lastVerifiedBackup = backupHistory.find((b) => b.status === 'VERIFIED' || b.status === 'SUCCESS');
  const lastVerifiedRestore = restoreLogs.find((r) => r.status === 'COMPLETED' && r.sha256Verified);

  const handleMigrate = async () => {
    setIsMigrating(true);
    setMigrationMsg(null);
    try {
      const res = await migrateLegacyDocumentsToDrive(false);
      if (res.success && res.report) {
        setMigrationMsg({
          type: 'success',
          text: `Migrated & verified ${res.report.migratedCount}/${res.report.totalIdentified} legacy Base64 document(s) to Google Drive. Originals retained safely until verified.`,
        });
      } else {
        setMigrationMsg({
          type: 'error',
          text: res.error || `Migration finished with ${res.report?.failedCount || 0} failure(s). Failed originals retained.`,
        });
      }
      setRefreshTick((t) => t + 1);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleRollback = () => {
    const ok = rollbackLastDocumentMigration();
    setMigrationMsg(
      ok
        ? { type: 'success', text: 'Document migration rolled back to pre-migration snapshot.' }
        : { type: 'error', text: 'No active migration snapshot available to roll back.' }
    );
    setRefreshTick((t) => t + 1);
  };

  const alertColors = {
    OK: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    WARNING: 'bg-amber-50 border-amber-200 text-amber-900',
    CRITICAL: 'bg-orange-50 border-orange-300 text-orange-900',
    ADMIN_ALERT: 'bg-rose-50 border-rose-300 text-rose-900',
  };

  return (
    <div className="space-y-5 text-xs">
      {/* Phase 9: Supabase Free-Tier Quota Monitor */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              <span>Supabase Free-Tier Quota &amp; Storage Monitor</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Configurable quota assumptions (~{snapshot.databaseLimitMb} MB DB, ~{snapshot.fileStorageLimitMb} MB File Storage, ~{snapshot.egressLimitMb} MB Egress). Original documents are never auto-deleted.
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase ${alertColors[snapshot.alertLevel]}`}>
            Status: {snapshot.alertLevel} {snapshot.uploadsRestricted ? '(Uploads Restricted)' : ''}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase">PostgreSQL DB Usage</span>
            <p className="text-sm font-black font-mono text-slate-900 mt-1">
              {snapshot.databaseUsedMb} / {snapshot.databaseLimitMb} MB
            </p>
            <span className="text-[10px] text-slate-500">{snapshot.databaseUsagePct}% used · {snapshot.remainingDatabaseMb} MB left</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase">File Storage Usage</span>
            <p className="text-sm font-black font-mono text-slate-900 mt-1">
              {snapshot.fileStorageUsedMb} / {snapshot.fileStorageLimitMb} MB
            </p>
            <span className="text-[10px] text-slate-500">{snapshot.fileStorageUsagePct}% used · {snapshot.remainingFileStorageMb} MB left</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Documents &amp; Previews</span>
            <p className="text-sm font-black font-mono text-slate-900 mt-1">{snapshot.documentCount} files</p>
            <span className="text-[10px] text-slate-500">
              Orig: {fmtBytes(snapshot.originalTotalBytes)} · Previews: {fmtBytes(snapshot.compressedPreviewTotalBytes)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Backups &amp; Monthly Growth</span>
            <p className="text-sm font-black font-mono text-slate-900 mt-1">{fmtBytes(snapshot.backupTotalBytes)}</p>
            <span className="text-[10px] text-slate-500">
              30d growth: {fmtBytes(snapshot.monthlyGrowthBytes)} · Failed: {snapshot.failedUploadCount} · Pending: {snapshot.pendingUploadCount}
            </span>
          </div>
        </div>

        {/* Phase 7.5 Base64-to-Google-Drive Safe Migration */}
        <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-bold text-indigo-950 flex items-center gap-1.5">
              <FileArchive className="w-4 h-4 text-indigo-600" />
              <span>Legacy Base64 Attachment Migration ({legacyBase64Count} pending)</span>
            </p>
            <p className="text-[11px] text-indigo-800 mt-0.5">
              Safely uploads original documents to Google Drive, verifies SHA-256 remotely, and retains local copies until verified with full rollback support.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isMigrating || legacyBase64Count === 0}
              onClick={handleMigrate}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{isMigrating ? 'Migrating...' : 'Migrate to Drive'}</span>
            </button>
            <button
              type="button"
              onClick={handleRollback}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rollback</span>
            </button>
          </div>
        </div>

        {migrationMsg && (
          <div
            className={`p-3 rounded-xl border font-semibold flex items-center gap-2 ${
              migrationMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {migrationMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{migrationMsg.text}</span>
          </div>
        )}

        {snapshot.largestFiles.length > 0 && (
          <div>
            <h4 className="text-[11px] font-bold text-slate-600 uppercase mb-1.5">Largest Stored Documents</h4>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {snapshot.largestFiles.slice(0, 5).map((f) => (
                <div key={f.id} className="px-3 py-2 flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800 truncate">{f.name}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">{f.provider}</span>
                  <span className="font-mono font-bold text-slate-900 shrink-0">{fmtBytes(f.sizeBytes)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Phase 10: Offline Mode & Multi-Device Sync Telemetry */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            {telemetry.isOnline ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-rose-600" />}
            <span>Offline Mode (IndexedDB) &amp; Sync Status</span>
          </h3>
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Last Sync</span>
            <p className="font-mono font-bold text-slate-900 mt-0.5 truncate">
              {telemetry.lastSyncAt ? telemetry.lastSyncAt.slice(0, 16).replace('T', ' ') : 'Not yet synced'}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Pending Changes</span>
            <p className="font-mono font-black text-amber-700 mt-0.5">{telemetry.pendingCount}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Failed Changes</span>
            <p className="font-mono font-black text-rose-700 mt-0.5">{telemetry.failedCount}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Conflicts</span>
            <p className="font-mono font-black text-rose-700 mt-0.5">{telemetry.conflictCount}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Last Backup</span>
            <p className="font-mono font-bold text-emerald-700 mt-0.5 truncate">
              {lastVerifiedBackup ? lastVerifiedBackup.createdAt.slice(0, 10) : 'None'}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Last Restore Verify</span>
            <p className="font-mono font-bold text-indigo-700 mt-0.5 truncate">
              {lastVerifiedRestore ? lastVerifiedRestore.restoredAt.slice(0, 10) : 'None'}
            </p>
          </div>
        </div>

        {conflicts.length > 0 && (
          <div className="space-y-2 pt-1">
            <h4 className="text-[11px] font-bold text-rose-700 uppercase">Unresolved Sync Conflicts ({conflicts.length})</h4>
            {conflicts.map((c) => (
              <div key={c.id} className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-rose-900">{c.entityType} #{c.entityId}</span>
                  <span className="block text-[10px] text-rose-700">
                    Server updated {c.serverTimestamp.slice(0, 16)} vs Client {c.clientTimestamp.slice(0, 16)}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      offlineSyncService.resolveConflict(c.id, 'KEEP_SERVER', currentUser.fullName);
                      setRefreshTick((t) => t + 1);
                    }}
                    className="px-2.5 py-1 rounded bg-slate-900 text-white font-bold text-[10px] cursor-pointer"
                  >
                    Keep Server
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      offlineSyncService.resolveConflict(c.id, 'SAVE_AS_NEW', currentUser.fullName);
                      setRefreshTick((t) => t + 1);
                    }}
                    className="px-2.5 py-1 rounded bg-indigo-600 text-white font-bold text-[10px] cursor-pointer"
                  >
                    Save As New
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-1">
          <HardDrive className="w-3.5 h-3.5" />
          <span>
            IndexedDB Persistence: <strong>{telemetry.indexedDbEnabled ? 'Active' : 'Fallback Mode'}</strong> · Pending Document Uploads: <strong>{telemetry.pendingUploadCount}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
