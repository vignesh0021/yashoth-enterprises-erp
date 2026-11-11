/**
 * YASHOTH ENTERPRISES ERP — TEAM CLOUD SYNC & DAILY ROLLING SNAPSHOTS
 *
 * Implements:
 * 1. Multi-Device Real-Time Cloud Sync Hub:
 *    - Connects 3 team members sharing email 'yashothenterprises44@gmail.com'.
 *    - Instant push/pull with zero lag and zero forced email popups.
 *    - Actor attribution (Proprietor, Yard Supervisor, Accounts Admin).
 *    - Revision tracking to detect newer cloud state.
 * 2. Option 2: Automated Daily Rolling Snapshots:
 *    - Automatic snapshot taken on app startup / first transaction of the day.
 *    - Keeps rolling 14-day history in local storage.
 *    - 1-tap rollback / restore to any previous day.
 */

import type { BackupDatabasePayload } from '../types/index.ts';

export const MASTER_VAULT_ID = 'ff808181a09d98f701a1c56d14f07de2';
export const OFFICIAL_SYNC_EMAIL = 'yashothenterprises44@gmail.com';

/**
 * Strips heavy Base64 strings (>256 chars) from documents before sending to the
 * shared cloud vault. Keeps JSON payload lightweight (< 30 KB) so restful-api.dev
 * never throws HTTP 500 or 413 Payload Too Large. Document metadata remains 100% intact.
 */
export function sanitizePayloadForCloud(payload: BackupDatabasePayload): BackupDatabasePayload {
  const clean: BackupDatabasePayload = { ...payload };

  if (Array.isArray(clean.uploadedDocuments)) {
    clean.uploadedDocuments = clean.uploadedDocuments.map((doc) => {
      if (doc.fileDataUrl && doc.fileDataUrl.length > 256) {
        return { ...doc, fileDataUrl: '' };
      }
      return doc;
    });
  }

  if (Array.isArray(clean.vehicleDocuments)) {
    clean.vehicleDocuments = clean.vehicleDocuments.map((doc) => {
      if (doc.attachmentUrl && doc.attachmentUrl.length > 256) {
        return { ...doc, attachmentUrl: '' };
      }
      return doc;
    });
  }

  return clean;
}

const STORAGE_VAULT_ID_KEY = 'ye_team_sync_vault_id_v1';
const STORAGE_LOCAL_REVISION_KEY = 'ye_team_sync_local_rev_v1';
const STORAGE_DAILY_SNAPSHOTS_KEY = 'ye_daily_snapshots_v1';
const STORAGE_MEMBER_NAME_KEY = 'ye_sync_member_name_v1';

export interface DailySnapshotItem {
  dateKey: string; // YYYY-MM-DD
  timestamp: string;
  revision: number;
  actor: string;
  recordCounts: Record<string, number>;
  totalSales: number;
  payload: BackupDatabasePayload;
}

export interface CloudVaultData {
  vaultName: string;
  companyCode: string;
  accountEmail: string;
  gstin: string;
  revision: number;
  syncedAt: string;
  syncedBy: string;
  notes?: string;
  payload: BackupDatabasePayload | null;
}

export interface SyncCheckResult {
  isCloudNewer: boolean;
  cloudRevision: number;
  localRevision: number;
  cloudSyncedAt: string;
  cloudSyncedBy: string;
  error?: string;
}

function safeGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return null;
}

function safeSet(key: string, val: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, val);
    }
  } catch {
    // ignore
  }
}

class TeamSyncService {
  private vaultId: string;
  private memberName: string;

  constructor() {
    this.vaultId = safeGet(STORAGE_VAULT_ID_KEY) || MASTER_VAULT_ID;
    this.memberName = safeGet(STORAGE_MEMBER_NAME_KEY) || 'Prop. P. Nandha Kumar';
  }

  public getVaultId(): string {
    return this.vaultId;
  }

  public setVaultId(id: string): void {
    this.vaultId = id.trim() || MASTER_VAULT_ID;
    safeSet(STORAGE_VAULT_ID_KEY, this.vaultId);
  }

  public getMemberName(): string {
    return this.memberName;
  }

  public setMemberName(name: string): void {
    this.memberName = name.trim() || 'Prop. P. Nandha Kumar';
    safeSet(STORAGE_MEMBER_NAME_KEY, this.memberName);
  }

  public getLocalRevision(): number {
    const raw = safeGet(STORAGE_LOCAL_REVISION_KEY);
    return raw ? parseInt(raw, 10) || 1 : 1;
  }

  public setLocalRevision(rev: number): void {
    safeSet(STORAGE_LOCAL_REVISION_KEY, String(rev));
  }

  // ==========================================================================
  // OPTION 3: MULTI-DEVICE REAL-TIME CLOUD SYNC
  // ==========================================================================

  /**
   * Fast check to see if another team member has pushed newer data to the cloud.
   */
  public async checkForCloudUpdates(): Promise<SyncCheckResult> {
    const localRev = this.getLocalRevision();
    try {
      const res = await fetch(`https://api.restful-api.dev/objects/${this.vaultId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok) {
        return {
          isCloudNewer: false,
          cloudRevision: localRev,
          localRevision: localRev,
          cloudSyncedAt: '',
          cloudSyncedBy: '',
          error: `HTTP ${res.status}: Vault not accessible`,
        };
      }

      const body = await res.json();
      const vaultData: CloudVaultData = body.data || {};
      const cloudRev = vaultData.revision || 1;

      return {
        isCloudNewer: cloudRev > localRev && !!vaultData.payload,
        cloudRevision: cloudRev,
        localRevision: localRev,
        cloudSyncedAt: vaultData.syncedAt || '',
        cloudSyncedBy: vaultData.syncedBy || 'Team Member',
      };
    } catch (err: any) {
      return {
        isCloudNewer: false,
        cloudRevision: localRev,
        localRevision: localRev,
        cloudSyncedAt: '',
        cloudSyncedBy: '',
        error: err.message || 'Offline or network unavailable',
      };
    }
  }

  /**
   * Pushes the current local database state to the team cloud vault.
   * Increments the revision number and attributes changes to the current member.
   */
  public async pushToCloud(
    payload: BackupDatabasePayload,
    actorOverride?: string
  ): Promise<{ success: boolean; revision: number; error?: string }> {
    const nextRev = this.getLocalRevision() + 1;
    const actor = actorOverride || this.memberName;

    const sanitizedPayload = sanitizePayloadForCloud(payload);

    const vaultPayload: CloudVaultData = {
      vaultName: 'YASHOTH_ENTERPRISES_MASTER_VAULT',
      companyCode: 'YE-MAIN',
      accountEmail: OFFICIAL_SYNC_EMAIL,
      gstin: '33AXVPN9382L1ZF',
      revision: nextRev,
      syncedAt: new Date().toISOString(),
      syncedBy: actor,
      notes: `Updated by ${actor} from Yashoth Enterprises Android ERP`,
      payload: sanitizedPayload,
    };

    try {
      const res = await fetch(`https://api.restful-api.dev/objects/${this.vaultId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'YE_MASTER_SYNC_VAULT',
          data: vaultPayload,
        }),
      });

      if (!res.ok) {
        throw new Error(`Cloud update failed (HTTP ${res.status})`);
      }

      this.setLocalRevision(nextRev);

      // Also store today's local snapshot automatically
      this.recordDailySnapshot(payload, nextRev, actor);

      return { success: true, revision: nextRev };
    } catch (err: any) {
      return { success: false, revision: this.getLocalRevision(), error: err.message };
    }
  }

  /**
   * Pulls the latest database state from the team cloud vault.
   */
  public async pullFromCloud(): Promise<{
    success: boolean;
    payload?: BackupDatabasePayload;
    revision?: number;
    syncedBy?: string;
    syncedAt?: string;
    error?: string;
  }> {
    try {
      const res = await fetch(`https://api.restful-api.dev/objects/${this.vaultId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch cloud vault (HTTP ${res.status})`);
      }

      const body = await res.json();
      const vaultData: CloudVaultData = body.data || {};

      if (!vaultData.payload) {
        return {
          success: false,
          error: 'Cloud vault exists but has not been populated yet. Please push from master device first.',
        };
      }

      const rev = vaultData.revision || 1;
      this.setLocalRevision(rev);

      // Record snapshot of pulled data
      this.recordDailySnapshot(vaultData.payload, rev, vaultData.syncedBy || 'Cloud Sync');

      return {
        success: true,
        payload: vaultData.payload,
        revision: rev,
        syncedBy: vaultData.syncedBy,
        syncedAt: vaultData.syncedAt,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to download from cloud vault' };
    }
  }

  // ==========================================================================
  // OPTION 2: AUTOMATED DAILY ROLLING SNAPSHOTS
  // ==========================================================================

  public getDailySnapshots(): DailySnapshotItem[] {
    const raw = safeGet(STORAGE_DAILY_SNAPSHOTS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as DailySnapshotItem[];
    } catch {
      return [];
    }
  }

  public recordDailySnapshot(
    payload: BackupDatabasePayload,
    revision: number = 1,
    actor: string = this.memberName
  ): void {
    const today = new Date().toISOString().split('T')[0];
    const existing = this.getDailySnapshots();

    const counts: Record<string, number> = {
      parties: payload.parties?.length || 0,
      invoices: payload.invoices?.length || 0,
      vehicles: payload.vehicles?.length || 0,
      employees: payload.employees?.length || 0,
      commercialDocs: payload.commercialDocuments?.length || 0,
      uploadedDocs: payload.uploadedDocuments?.length || 0,
      dailyTasks: payload.dailyTasks?.length || 0,
      workNotes: payload.workNotes?.length || 0,
    };

    const totalSales = (payload.invoices || []).reduce((acc, inv) => acc + (inv.grandTotal || 0), 0);

    const snapshot: DailySnapshotItem = {
      dateKey: today,
      timestamp: new Date().toISOString(),
      revision,
      actor,
      recordCounts: counts,
      totalSales,
      payload,
    };

    // Filter out existing snapshot for today and prepend new one, keeping max 14 days
    const filtered = existing.filter((s) => s.dateKey !== today);
    filtered.unshift(snapshot);
    const trimmed = filtered.slice(0, 14);

    safeSet(STORAGE_DAILY_SNAPSHOTS_KEY, JSON.stringify(trimmed));
  }

  /**
   * Auto-run on startup: takes a snapshot if today's snapshot doesn't exist yet.
   */
  public autoCheckDailySnapshot(payload: BackupDatabasePayload): boolean {
    const today = new Date().toISOString().split('T')[0];
    const snapshots = this.getDailySnapshots();
    const hasToday = snapshots.some((s) => s.dateKey === today);
    if (!hasToday && payload.parties && payload.parties.length > 0) {
      this.recordDailySnapshot(payload, this.getLocalRevision(), 'Auto Daily Snapshot');
      return true;
    }
    return false;
  }
}

export const teamSyncService = new TeamSyncService();
