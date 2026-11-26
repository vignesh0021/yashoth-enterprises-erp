/**
 * YASHOTH ENTERPRISES ERP — PHASE 7 & 10 INDEXEDDB PERSISTENCE LAYER
 *
 * Stores offline business-data cache, pending transaction queue, temporary uploads,
 * and sync history in IndexedDB (keeping localStorage strictly for tiny config values).
 * Gracefully falls back to an in-memory Map in Node/Vitest environments without indexedDB.
 */

const DB_NAME = 'yashoth_erp_offline_db';
const DB_VERSION = 1;

export type IdbStoreName = 'business_cache' | 'mutation_queue' | 'upload_queue' | 'sync_history';

export interface PendingUploadItem {
  id: string;
  companyId: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  dataBase64: string;
  sha256Checksum: string;
  transactionRef?: string;
  retryCount: number;
  status: 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FAILED';
  error?: string;
  createdAt: string;
}

export interface SyncHistoryRecord {
  id: string;
  companyId: string;
  timestamp: string;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  uploadsCompleted: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  notes?: string;
}

class IndexedDbService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryFallback: Map<string, Map<string, any>> = new Map([
    ['business_cache', new Map()],
    ['mutation_queue', new Map()],
    ['upload_queue', new Map()],
    ['sync_history', new Map()],
  ]);

  public isIndexedDbAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  private openDb(): Promise<IDBDatabase | null> {
    if (!this.isIndexedDbAvailable()) {
      return Promise.resolve(null);
    }
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          const stores: IdbStoreName[] = ['business_cache', 'mutation_queue', 'upload_queue', 'sync_history'];
          for (const store of stores) {
            if (!db.objectStoreNames.contains(store)) {
              db.createObjectStore(store);
            }
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  public async put<T>(store: IdbStoreName, key: string, value: T): Promise<void> {
    this.memoryFallback.get(store)?.set(key, value);
    const db = await this.openDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  public async get<T>(store: IdbStoreName, key: string): Promise<T | null> {
    const db = await this.openDb();
    if (!db) {
      return (this.memoryFallback.get(store)?.get(key) as T) ?? null;
    }

    return new Promise<T | null>((resolve) => {
      try {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve((req.result as T) ?? (this.memoryFallback.get(store)?.get(key) as T) ?? null);
        req.onerror = () => resolve((this.memoryFallback.get(store)?.get(key) as T) ?? null);
      } catch {
        resolve((this.memoryFallback.get(store)?.get(key) as T) ?? null);
      }
    });
  }

  public async getAll<T>(store: IdbStoreName): Promise<T[]> {
    const db = await this.openDb();
    if (!db) {
      return Array.from(this.memoryFallback.get(store)?.values() || []) as T[];
    }

    return new Promise<T[]>((resolve) => {
      try {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve((req.result as T[]) || []);
        req.onerror = () => resolve(Array.from(this.memoryFallback.get(store)?.values() || []) as T[]);
      } catch {
        resolve(Array.from(this.memoryFallback.get(store)?.values() || []) as T[]);
      }
    });
  }

  public async delete(store: IdbStoreName, key: string): Promise<void> {
    this.memoryFallback.get(store)?.delete(key);
    const db = await this.openDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  public async clearStore(store: IdbStoreName): Promise<void> {
    this.memoryFallback.get(store)?.clear();
    const db = await this.openDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

export const indexedDbService = new IndexedDbService();
