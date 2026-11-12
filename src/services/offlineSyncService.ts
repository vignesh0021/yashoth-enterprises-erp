/**
 * YASHOTH ENTERPRISES ERP — PHASE 7 OFFLINE SYNC & CONFLICT ENGINE
 *
 * Implements:
 * 1. Reactive network connectivity tracking (Online / Offline).
 * 2. Multi-company isolated offline mutation queue.
 * 3. Strict conflict detection: prevents offline edits from silently overwriting newer records.
 * 4. Conflict resolution ledger with manual and rule-based resolution.
 * 5. Persistent storage in localStorage with auto-sync on network reconnect.
 */

export type OfflineEntityType =
  | 'WEIGHMENT'
  | 'PURCHASE'
  | 'INVOICE'
  | 'EXPENSE'
  | 'PAYMENT'
  | 'ATTENDANCE'
  | 'PARTY';

export type OfflineAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type OfflineMutationStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'FAILED';

export interface OfflineMutation<T = any> {
  id: string;
  companyId: string;
  entityType: OfflineEntityType;
  entityId: string;
  action: OfflineAction;
  clientTimestamp: string;
  baseServerTimestamp?: string;
  payload: T;
  status: OfflineMutationStatus;
  retryCount: number;
  error?: string;
  conflictId?: string;
}

export interface ConflictLog {
  id: string;
  mutationId: string;
  companyId: string;
  entityType: OfflineEntityType;
  entityId: string;
  detectedAt: string;
  serverTimestamp: string;
  clientTimestamp: string;
  serverSnapshot: any;
  clientPayload: any;
  resolved: boolean;
  resolutionStrategy?: 'KEEP_SERVER' | 'FORCE_CLIENT' | 'SAVE_AS_NEW';
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  conflictCount: number;
  lastSyncAt: string | null;
  isSyncing: boolean;
}

const STORAGE_QUEUE_KEY = 'ye_erp_offline_queue_v1';
const STORAGE_CONFLICTS_KEY = 'ye_erp_offline_conflicts_v1';
const STORAGE_LAST_SYNC_KEY = 'ye_erp_last_sync_time_v1';

class OfflineSyncService {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private statusListeners: Set<(status: SyncStatus) => void> = new Set();
  private memoryQueue: OfflineMutation[] = [];
  private memoryConflicts: ConflictLog[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyStatus();
        this.triggerAutoSync();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyStatus();
      });
    }
  }

  // --------------------------------------------------------------------------
  // NETWORK & STATUS SUBSCRIBERS
  // --------------------------------------------------------------------------
  public getStatus(companyId?: string): SyncStatus {
    const queue = this.loadQueue();
    const conflicts = this.loadConflicts();

    const filteredQueue = companyId ? queue.filter((m) => m.companyId === companyId) : queue;
    const filteredConflicts = companyId ? conflicts.filter((c) => c.companyId === companyId) : conflicts;

    const pending = filteredQueue.filter((m) => m.status === 'PENDING' || m.status === 'FAILED').length;
    const unresolvedConflicts = filteredConflicts.filter((c) => !c.resolved).length;
    const lastSyncAt = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_LAST_SYNC_KEY) : null;

    return {
      isOnline: this.isOnline,
      pendingCount: pending,
      conflictCount: unresolvedConflicts,
      lastSyncAt,
      isSyncing: this.isSyncing,
    };
  }

  public subscribe(listener: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatus(): void {
    const status = this.getStatus();
    this.statusListeners.forEach((l) => l(status));
  }

  // --------------------------------------------------------------------------
  // QUEUE OPERATIONS
  // --------------------------------------------------------------------------
  public enqueueMutation<T = any>(params: {
    companyId: string;
    entityType: OfflineEntityType;
    entityId: string;
    action: OfflineAction;
    payload: T;
    baseServerTimestamp?: string;
  }): OfflineMutation<T> {
    const mutation: OfflineMutation<T> = {
      id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      companyId: params.companyId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      clientTimestamp: new Date().toISOString(),
      baseServerTimestamp: params.baseServerTimestamp,
      payload: params.payload,
      status: 'PENDING',
      retryCount: 0,
    };

    const queue = this.loadQueue();
    queue.push(mutation);
    this.saveQueue(queue);
    this.notifyStatus();

    // If online, attempt background sync immediately
    if (this.isOnline) {
      setTimeout(() => this.triggerAutoSync(), 100);
    }

    return mutation;
  }

  public getPendingMutations(companyId?: string): OfflineMutation[] {
    const queue = this.loadQueue();
    return queue.filter((m) => {
      const matchComp = !companyId || m.companyId === companyId;
      return matchComp && (m.status === 'PENDING' || m.status === 'FAILED');
    });
  }

  public getConflictLogs(companyId?: string): ConflictLog[] {
    const conflicts = this.loadConflicts();
    return companyId ? conflicts.filter((c) => c.companyId === companyId) : conflicts;
  }

  // --------------------------------------------------------------------------
  // STRICT CONFLICT DETECTION & RESOLUTION
  // --------------------------------------------------------------------------
  /**
   * Checks whether an incoming offline edit conflicts with the current server record.
   * A conflict occurs if the server record was updated after the client's base snapshot timestamp.
   */
  public evaluateConflict(
    mutation: OfflineMutation,
    currentServerRecord: any | null | undefined
  ): { hasConflict: boolean; reason?: string } {
    if (!currentServerRecord) {
      return { hasConflict: false };
    }

    // For create actions on non-existent records, no conflict
    if (mutation.action === 'CREATE') {
      return { hasConflict: false };
    }

    // Check server updated timestamp
    const serverUpdated = currentServerRecord.updatedAt || currentServerRecord.createdAt;
    if (!serverUpdated) {
      return { hasConflict: false };
    }

    if (mutation.baseServerTimestamp) {
      const serverTime = new Date(serverUpdated).getTime();
      const baseTime = new Date(mutation.baseServerTimestamp).getTime();

      if (serverTime > baseTime) {
        return {
          hasConflict: true,
          reason: `Server record was modified at ${serverUpdated}, which is newer than offline base snapshot (${mutation.baseServerTimestamp}).`,
        };
      }
    }

    return { hasConflict: false };
  }

  /**
   * Records a detected conflict without overwriting server data.
   */
  public recordConflict(
    mutation: OfflineMutation,
    serverSnapshot: any
  ): ConflictLog {
    const conflict: ConflictLog = {
      id: `conf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      mutationId: mutation.id,
      companyId: mutation.companyId,
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      detectedAt: new Date().toISOString(),
      serverTimestamp: serverSnapshot.updatedAt || serverSnapshot.createdAt || new Date().toISOString(),
      clientTimestamp: mutation.clientTimestamp,
      serverSnapshot,
      clientPayload: mutation.payload,
      resolved: false,
    };

    // Update mutation status
    const queue = this.loadQueue();
    const target = queue.find((m) => m.id === mutation.id);
    if (target) {
      target.status = 'CONFLICT';
      target.conflictId = conflict.id;
      this.saveQueue(queue);
    }

    // Save conflict log
    const conflicts = this.loadConflicts();
    conflicts.unshift(conflict);
    this.saveConflicts(conflicts);

    this.notifyStatus();
    return conflict;
  }

  /**
   * Manually resolves a conflict with user-chosen strategy:
   * - KEEP_SERVER: Discard offline client mutation.
   * - FORCE_CLIENT: Apply client mutation over server record.
   * - SAVE_AS_NEW: Client mutation is assigned a new UUID and saved as a parallel record.
   */
  public resolveConflict(
    conflictId: string,
    strategy: 'KEEP_SERVER' | 'FORCE_CLIENT' | 'SAVE_AS_NEW',
    resolvedBy: string = 'User'
  ): { success: boolean; error?: string } {
    const conflicts = this.loadConflicts();
    const conflict = conflicts.find((c) => c.id === conflictId);
    if (!conflict) {
      return { success: false, error: 'Conflict not found' };
    }

    conflict.resolved = true;
    conflict.resolutionStrategy = strategy;
    conflict.resolvedAt = new Date().toISOString();
    conflict.resolvedBy = resolvedBy;
    this.saveConflicts(conflicts);

    const queue = this.loadQueue();
    const mutation = queue.find((m) => m.id === conflict.mutationId);
    if (mutation) {
      if (strategy === 'KEEP_SERVER') {
        mutation.status = 'SYNCED'; // Discarded from pending
      } else if (strategy === 'FORCE_CLIENT') {
        mutation.status = 'PENDING'; // Re-queue to apply
        mutation.baseServerTimestamp = undefined; // Bypass conflict check
      } else if (strategy === 'SAVE_AS_NEW') {
        mutation.status = 'PENDING';
        mutation.entityId = `copy-${Date.now()}`;
        if (mutation.payload && typeof mutation.payload === 'object') {
          mutation.payload.id = mutation.entityId;
        }
        mutation.action = 'CREATE';
        mutation.baseServerTimestamp = undefined;
      }
      this.saveQueue(queue);
    }

    this.notifyStatus();
    return { success: true };
  }

  // --------------------------------------------------------------------------
  // SYNC EXECUTION
  // --------------------------------------------------------------------------
  public async flushQueue(
    executor: (mutation: OfflineMutation) => Promise<{ success: boolean; currentServerRecord?: any; error?: string }>
  ): Promise<{ synced: number; conflicts: number; failed: number }> {
    if (this.isSyncing) return { synced: 0, conflicts: 0, failed: 0 };

    this.isSyncing = true;
    this.notifyStatus();

    let synced = 0;
    let conflicts = 0;
    let failed = 0;

    const queue = this.loadQueue();
    const pendingList = queue.filter((m) => m.status === 'PENDING' || m.status === 'FAILED');

    for (const mutation of pendingList) {
      try {
        mutation.status = 'SYNCING';
        this.saveQueue(queue);

        const result = await executor(mutation);

        if (result.success) {
          mutation.status = 'SYNCED';
          synced++;
        } else if (result.currentServerRecord) {
          // Server conflict returned
          this.recordConflict(mutation, result.currentServerRecord);
          conflicts++;
        } else {
          mutation.status = 'FAILED';
          mutation.retryCount = (mutation.retryCount || 0) + 1;
          mutation.error = result.error || 'Sync execution failed';
          failed++;
        }
      } catch (err: any) {
        mutation.status = 'FAILED';
        mutation.retryCount = (mutation.retryCount || 0) + 1;
        mutation.error = err.message || 'Network exception during sync';
        failed++;
      }
    }

    this.saveQueue(queue);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_LAST_SYNC_KEY, new Date().toISOString());
    }

    this.isSyncing = false;
    this.notifyStatus();

    return { synced, conflicts, failed };
  }

  private triggerAutoSync(): void {
    // If listeners or ERPContext handles queue flushing, status notification triggers it
    this.notifyStatus();
  }

  // --------------------------------------------------------------------------
  // PERSISTENCE HELPERS
  // --------------------------------------------------------------------------
  private loadQueue(): OfflineMutation[] {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_QUEUE_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return this.memoryQueue;
  }

  private saveQueue(queue: OfflineMutation[]): void {
    const filtered = queue.filter((m, idx, arr) => m.status !== 'SYNCED' || arr.length - idx < 50);
    this.memoryQueue = filtered;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn('[OfflineSyncService] Failed to save queue to localStorage:', e);
    }
  }

  private loadConflicts(): ConflictLog[] {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_CONFLICTS_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return this.memoryConflicts;
  }

  private saveConflicts(conflicts: ConflictLog[]): void {
    const trimmed = conflicts.slice(0, 100);
    this.memoryConflicts = trimmed;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_CONFLICTS_KEY, JSON.stringify(trimmed));
      }
    } catch (e) {
      console.warn('[OfflineSyncService] Failed to save conflicts to localStorage:', e);
    }
  }

  public clearAllDataForTesting(): void {
    this.memoryQueue = [];
    this.memoryConflicts = [];
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_QUEUE_KEY);
        localStorage.removeItem(STORAGE_CONFLICTS_KEY);
        localStorage.removeItem(STORAGE_LAST_SYNC_KEY);
      }
    } catch {}
  }
}

export const offlineSyncService = new OfflineSyncService();
