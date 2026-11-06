import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { offlineSyncService, type OfflineMutation } from '../src/services/offlineSyncService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// In-memory localStorage mock for Node.js test environment
class MemoryStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Ensure localStorage is immediately available
(globalThis as any).localStorage = new MemoryStorage();

describe('Phase 7: Mobile Application, PWA & Offline Engine', () => {
  beforeEach(() => {
    (globalThis as any).localStorage.clear();
    offlineSyncService.clearAllDataForTesting();
  });

  describe('1. PWA Web App Manifest Specification', () => {
    const manifestPath = path.join(projectRoot, 'public', 'manifest.webmanifest');

    it('manifest file exists and is valid JSON', () => {
      expect(fs.existsSync(manifestPath)).toBe(true);
      const content = fs.readFileSync(manifestPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('manifest defines standalone display, proper scrap ERP naming, and color scheme', () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(manifest.display).toBe('standalone');
      expect(manifest.name).toContain('Yashoth Enterprises');
      expect(manifest.short_name).toBe('YE ERP');
      expect(manifest.start_url).toBe('/');
      expect(manifest.theme_color).toBe('#dc2626');
      expect(manifest.background_color).toBe('#0f172a');
      expect(manifest.icons).toBeInstanceOf(Array);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

      const has192 = manifest.icons.some((i: any) => i.sizes === '192x192');
      const has512 = manifest.icons.some((i: any) => i.sizes === '512x512');
      expect(has192).toBe(true);
      expect(has512).toBe(true);
    });

    it('manifest defines shortcuts for critical yard operations', () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(manifest.shortcuts).toBeInstanceOf(Array);
      expect(manifest.shortcuts.length).toBeGreaterThanOrEqual(2);

      const names = manifest.shortcuts.map((s: any) => s.name);
      expect(names).toContain('Weighment Entry');
      expect(names).toContain('Tax Invoices');
    });
  });

  describe('2. Service Worker File & Caching Strategy', () => {
    const swPath = path.join(projectRoot, 'public', 'sw.js');

    it('service worker file exists and contains lifecycle event handlers', () => {
      expect(fs.existsSync(swPath)).toBe(true);
      const swCode = fs.readFileSync(swPath, 'utf-8');

      expect(swCode).toContain("CACHE_NAME = 'ye-erp-pwa-v1'");
      expect(swCode).toContain("addEventListener('install'");
      expect(swCode).toContain("addEventListener('activate'");
      expect(swCode).toContain("addEventListener('fetch'");
      expect(swCode).toContain('self.skipWaiting()');
      expect(swCode).toContain('clients.claim()');
    });

    it('implements network-first navigation strategy with cache fallback', () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      expect(swCode).toContain("request.mode === 'navigate'");
      expect(swCode).toContain('fetch(request)');
      expect(swCode).toContain('caches.match');
    });
  });

  describe('3. Mobile Responsive HTML & CSS Standards', () => {
    const htmlPath = path.join(projectRoot, 'index.html');
    const cssPath = path.join(projectRoot, 'src', 'index.css');

    it('index.html includes viewport-fit=cover and interactive-widget=resizes-content', () => {
      const html = fs.readFileSync(htmlPath, 'utf-8');
      expect(html).toContain('viewport-fit=cover');
      expect(html).toContain('interactive-widget=resizes-content');
      expect(html).toContain('name="theme-color"');
      expect(html).toContain('rel="manifest"');
      expect(html).toContain("navigator.serviceWorker.register('/sw.js')");
    });

    it('src/index.css includes safe-area insets, 16px input font size, and touch optimization', () => {
      const css = fs.readFileSync(cssPath, 'utf-8');
      // Safe area variables
      expect(css).toContain('--sat: env(safe-area-inset-top');
      expect(css).toContain('--sab: env(safe-area-inset-bottom');
      expect(css).toContain('--sal: env(safe-area-inset-left');
      expect(css).toContain('--sar: env(safe-area-inset-right');

      // 16px input rule to prevent mobile safari / chrome auto-zoom
      expect(css).toContain('font-size: 16px');

      // Touch highlight kill & manipulation
      expect(css).toContain('-webkit-tap-highlight-color: transparent');
      expect(css).toContain('touch-action: manipulation');

      // Dynamic viewport height support
      expect(css).toContain('100dvh');
    });
  });

  describe('4. Offline Queue & Multi-Company Isolation', () => {
    const companyA = 'a0000000-0000-0000-0000-000000000001'; // Yashoth Enterprises
    const companyB = 'b0000000-0000-0000-0000-000000000002'; // Cauvery Scrap

    it('enqueues mutations and preserves them in storage', () => {
      const mut = offlineSyncService.enqueueMutation({
        companyId: companyA,
        entityType: 'WEIGHMENT',
        entityId: 'weigh-101',
        action: 'CREATE',
        payload: { grossWeight: 14500, tareWeight: 6200, netWeight: 8300 },
      });

      expect(mut.id).toMatch(/^mut-/);
      expect(mut.status).toBe('PENDING');

      const pending = offlineSyncService.getPendingMutations();
      expect(pending.length).toBe(1);
      expect(pending[0].entityId).toBe('weigh-101');
    });

    it('strictly isolates pending mutations between Company A and Company B', () => {
      offlineSyncService.enqueueMutation({
        companyId: companyA,
        entityType: 'PURCHASE',
        entityId: 'po-ye-01',
        action: 'CREATE',
        payload: { amount: 50000 },
      });

      offlineSyncService.enqueueMutation({
        companyId: companyB,
        entityType: 'INVOICE',
        entityId: 'inv-cs-01',
        action: 'CREATE',
        payload: { amount: 25000 },
      });

      const yePending = offlineSyncService.getPendingMutations(companyA);
      const csPending = offlineSyncService.getPendingMutations(companyB);
      const allPending = offlineSyncService.getPendingMutations();

      expect(yePending.length).toBe(1);
      expect(yePending[0].entityId).toBe('po-ye-01');

      expect(csPending.length).toBe(1);
      expect(csPending[0].entityId).toBe('inv-cs-01');

      expect(allPending.length).toBe(2);
    });
  });

  describe('5. Strict Conflict Detection & Invariants', () => {
    const companyId = 'a0000000-0000-0000-0000-000000000001';

    it('CREATE actions never conflict with server records', () => {
      const mut: OfflineMutation = {
        id: 'mut-c1',
        companyId,
        entityType: 'EXPENSE',
        entityId: 'exp-1',
        action: 'CREATE',
        clientTimestamp: '2026-11-06T12:00:00.000Z',
        payload: { amount: 1500 },
        status: 'PENDING',
        retryCount: 0,
      };

      const result = offlineSyncService.evaluateConflict(mut, null);
      expect(result.hasConflict).toBe(false);
    });

    it('UPDATE does not conflict when server timestamp is equal or older than client base snapshot', () => {
      const mut: OfflineMutation = {
        id: 'mut-u1',
        companyId,
        entityType: 'PAYMENT',
        entityId: 'pay-1',
        action: 'UPDATE',
        clientTimestamp: '2026-11-06T12:00:00.000Z',
        baseServerTimestamp: '2026-11-06T10:00:00.000Z',
        payload: { amount: 5000 },
        status: 'PENDING',
        retryCount: 0,
      };

      const olderServerRecord = {
        id: 'pay-1',
        updatedAt: '2026-11-06T09:30:00.000Z',
      };

      const result = offlineSyncService.evaluateConflict(mut, olderServerRecord);
      expect(result.hasConflict).toBe(false);
    });

    it('UPDATE flags a STRICT CONFLICT when server timestamp is NEWER than client base snapshot', () => {
      const mut: OfflineMutation = {
        id: 'mut-u2',
        companyId,
        entityType: 'INVOICE',
        entityId: 'inv-99',
        action: 'UPDATE',
        clientTimestamp: '2026-11-06T12:00:00.000Z',
        baseServerTimestamp: '2026-11-06T10:00:00.000Z',
        payload: { totalAmount: 85000 },
        status: 'PENDING',
        retryCount: 0,
      };

      const newerServerRecord = {
        id: 'inv-99',
        updatedAt: '2026-11-06T11:45:00.000Z', // Modified on server after client went offline
        totalAmount: 92000,
      };

      const result = offlineSyncService.evaluateConflict(mut, newerServerRecord);
      expect(result.hasConflict).toBe(true);
      expect(result.reason).toContain('is newer than offline base snapshot');
    });
  });

  describe('6. Conflict Recording & Non-Destructive Resolution Strategies', () => {
    const companyId = 'a0000000-0000-0000-0000-000000000001';

    it('records conflict without overwriting server record', () => {
      const mut = offlineSyncService.enqueueMutation({
        companyId,
        entityType: 'PARTY',
        entityId: 'party-xyz',
        action: 'UPDATE',
        baseServerTimestamp: '2026-11-06T10:00:00.000Z',
        payload: { name: 'Client Edited Name' },
      });

      const serverSnapshot = {
        id: 'party-xyz',
        name: 'Server Side Updated Name',
        updatedAt: '2026-11-06T11:30:00.000Z',
      };

      const conflict = offlineSyncService.recordConflict(mut, serverSnapshot);
      expect(conflict.id).toMatch(/^conf-/);
      expect(conflict.resolved).toBe(false);
      expect(conflict.serverSnapshot.name).toBe('Server Side Updated Name');
      expect(conflict.clientPayload.name).toBe('Client Edited Name');

      const status = offlineSyncService.getStatus(companyId);
      expect(status.conflictCount).toBe(1);
    });

    it('KEEP_SERVER strategy discards offline mutation and marks conflict resolved', () => {
      const mut = offlineSyncService.enqueueMutation({
        companyId,
        entityType: 'EXPENSE',
        entityId: 'exp-123',
        action: 'UPDATE',
        baseServerTimestamp: '2026-11-06T10:00:00.000Z',
        payload: { amount: 300 },
      });

      const conflict = offlineSyncService.recordConflict(mut, {
        id: 'exp-123',
        amount: 500,
        updatedAt: '2026-11-06T11:00:00.000Z',
      });

      const res = offlineSyncService.resolveConflict(conflict.id, 'KEEP_SERVER', 'Admin');
      expect(res.success).toBe(true);

      const conflicts = offlineSyncService.getConflictLogs(companyId);
      expect(conflicts[0].resolved).toBe(true);
      expect(conflicts[0].resolutionStrategy).toBe('KEEP_SERVER');

      const pending = offlineSyncService.getPendingMutations(companyId);
      expect(pending.length).toBe(0); // Discarded from pending queue
    });

    it('FORCE_CLIENT strategy re-queues client mutation bypassing base timestamp', () => {
      const mut = offlineSyncService.enqueueMutation({
        companyId,
        entityType: 'EXPENSE',
        entityId: 'exp-456',
        action: 'UPDATE',
        baseServerTimestamp: '2026-11-06T10:00:00.000Z',
        payload: { amount: 750 },
      });

      const conflict = offlineSyncService.recordConflict(mut, {
        id: 'exp-456',
        amount: 600,
        updatedAt: '2026-11-06T11:00:00.000Z',
      });

      const res = offlineSyncService.resolveConflict(conflict.id, 'FORCE_CLIENT', 'Admin');
      expect(res.success).toBe(true);

      const pending = offlineSyncService.getPendingMutations(companyId);
      expect(pending.length).toBe(1);
      expect(pending[0].status).toBe('PENDING');
      expect(pending[0].baseServerTimestamp).toBeUndefined();
    });

    it('SAVE_AS_NEW strategy creates parallel entity with fresh ID preserving both copies', () => {
      const mut = offlineSyncService.enqueueMutation({
        companyId,
        entityType: 'WEIGHMENT',
        entityId: 'weigh-original',
        action: 'UPDATE',
        baseServerTimestamp: '2026-11-06T10:00:00.000Z',
        payload: { id: 'weigh-original', netWeight: 9200 },
      });

      const conflict = offlineSyncService.recordConflict(mut, {
        id: 'weigh-original',
        netWeight: 8900,
        updatedAt: '2026-11-06T11:00:00.000Z',
      });

      const res = offlineSyncService.resolveConflict(conflict.id, 'SAVE_AS_NEW', 'Admin');
      expect(res.success).toBe(true);

      const pending = offlineSyncService.getPendingMutations(companyId);
      expect(pending.length).toBe(1);
      expect(pending[0].action).toBe('CREATE');
      expect(pending[0].entityId).toMatch(/^copy-/);
      expect(pending[0].payload.id).toBe(pending[0].entityId);
    });
  });

  describe('7. Flush Queue & Network Synchronization Simulation', () => {
    const companyId = 'a0000000-0000-0000-0000-000000000001';

    it('flushes pending queue sequentially and marks synced on success', async () => {
      offlineSyncService.enqueueMutation({
        companyId,
        entityType: 'ATTENDANCE',
        entityId: 'att-1',
        action: 'CREATE',
        payload: { employeeId: 'emp-1', status: 'PRESENT' },
      });

      offlineSyncService.enqueueMutation({
        companyId,
        entityType: 'ATTENDANCE',
        entityId: 'att-2',
        action: 'CREATE',
        payload: { employeeId: 'emp-2', status: 'PRESENT' },
      });

      const flushResult = await offlineSyncService.flushQueue(async (mutation) => {
        return { success: true };
      });

      expect(flushResult.synced).toBe(2);
      expect(flushResult.conflicts).toBe(0);
      expect(flushResult.failed).toBe(0);

      const remainingPending = offlineSyncService.getPendingMutations(companyId);
      expect(remainingPending.length).toBe(0);
    });

    it('handles network failure gracefully without dropping queue items', async () => {
      offlineSyncService.enqueueMutation({
        companyId,
        entityType: 'PAYMENT',
        entityId: 'pay-err',
        action: 'CREATE',
        payload: { amount: 1000 },
      });

      const flushResult = await offlineSyncService.flushQueue(async (mutation) => {
        throw new Error('503 Service Unavailable / Gateway Timeout');
      });

      expect(flushResult.failed).toBe(1);

      const pending = offlineSyncService.getPendingMutations(companyId);
      expect(pending.length).toBe(1);
      expect(pending[0].status).toBe('FAILED');
      expect(pending[0].retryCount).toBe(1);
      expect(pending[0].error).toContain('503 Service Unavailable');
    });

    it('detects server conflict during flush and automatically records it', async () => {
      offlineSyncService.enqueueMutation({
        companyId,
        entityType: 'INVOICE',
        entityId: 'inv-conflict',
        action: 'UPDATE',
        baseServerTimestamp: '2026-11-06T08:00:00.000Z',
        payload: { grandTotal: 50000 },
      });

      const flushResult = await offlineSyncService.flushQueue(async (mutation) => {
        return {
          success: false,
          currentServerRecord: {
            id: 'inv-conflict',
            grandTotal: 55000,
            updatedAt: '2026-11-06T09:00:00.000Z',
          },
        };
      });

      expect(flushResult.conflicts).toBe(1);
      expect(flushResult.synced).toBe(0);

      const conflicts = offlineSyncService.getConflictLogs(companyId);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].entityId).toBe('inv-conflict');
    });
  });
});
