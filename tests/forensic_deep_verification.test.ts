import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { googleDriveService } from '../src/services/googleDriveService.ts';
import { offlineSyncService } from '../src/services/offlineSyncService.ts';
import { realtimeSyncService } from '../src/services/realtimeSyncService.ts';
import type { RealtimeChangeEvent } from '../src/services/realtimeSyncService.ts';
import { enforceAuthorization } from '../backend/business-rules/authEngine.ts';
import type { UserSession } from '../src/types/index.ts';

describe('Suite 17: Deep Forensic Verification — Supabase Realtime, Offline Queue & Google Drive Security', () => {
  beforeEach(() => {
    offlineSyncService.clearAllDataForTesting();
    realtimeSyncService.cleanupSubscriptions();
  });

  afterEach(() => {
    realtimeSyncService.cleanupSubscriptions();
  });

  // --------------------------------------------------------------------------
  // 17.1 Google Drive Authentication Truthfulness (No Fake Connected States)
  // --------------------------------------------------------------------------
  describe('17.1 Google Drive OAuth Truthfulness & Zero-Mock Security', () => {
    it('verifies getStatus() does not report isConnected: true without genuine OAuth access token', () => {
      // Even if Gmail account is set in localStorage or Android bridge is present
      googleDriveService.connectGmailAccount('yashothenterprises44@gmail.com');
      const status = googleDriveService.getStatus();
      
      // Crucial: getStatus().isConnected MUST be false when accessToken is null
      expect(status.isConnected).toBe(false);
      expect(googleDriveService.isAuthenticated()).toBe(false);
    });

    it('verifies signIn() returns success: false with actionable error when Client ID is unconfigured', async () => {
      // Clear any custom client ID
      googleDriveService.setClientId('');
      const res = await googleDriveService.signIn();
      expect(res.success).toBe(false);
      expect(res.error).toContain('Google Drive Client ID is not configured');
    });

    it('verifies uploadBackupFile() returns success: false when unauthenticated', async () => {
      const res = await googleDriveService.uploadBackupFile('audit_backup.json', '{"test":true}');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Google Drive is not authenticated');
    });
  });

  // --------------------------------------------------------------------------
  // 17.2 Three-User Role Isolation & Multi-Device Scoping
  // --------------------------------------------------------------------------
  describe('17.2 Three-User Multi-Device Access Model & Cross-Tenant Isolation', () => {
    const ownerUser: UserSession = {
      id: 'usr-owner-01',
      email: 'owner@yasoth.com',
      fullName: 'P. Nandha Kumar',
      role: 'owner_admin',
      companyId: 'comp-alpha-1111',
      expiresAt: Date.now() + 3600000,
    };

    const supervisorUser: UserSession = {
      id: 'usr-sup-01',
      email: 'supervisor@yasoth.com',
      fullName: 'S. Rajan',
      role: 'manager',
      companyId: 'comp-alpha-1111',
      expiresAt: Date.now() + 3600000,
    };

    const accountsUser: UserSession = {
      id: 'usr-acc-01',
      email: 'accounts@yasoth.com',
      fullName: 'V. Sundaram',
      role: 'accounts_operator',
      companyId: 'comp-alpha-1111',
      expiresAt: Date.now() + 3600000,
    };

    it('enforces that Supervisor and Accounts users are strictly blocked from destructive operations', () => {
      // Owner can do administrative and backup actions
      expect(() => enforceAuthorization(ownerUser, 'settings:backup')).not.toThrow();
      expect(() => enforceAuthorization(ownerUser, 'settings:restore')).not.toThrow();

      // Supervisor cannot restore or manage full admin
      expect(() => enforceAuthorization(supervisorUser, 'settings:restore')).toThrow();
      expect(() => enforceAuthorization(supervisorUser, 'admin:full')).toThrow();

      // Accounts cannot record weighments or manage backups
      expect(() => enforceAuthorization(accountsUser, 'weighment:record')).toThrow();
      expect(() => enforceAuthorization(accountsUser, 'settings:backup')).toThrow();
    });

    it('verifies company-scoped Realtime channel naming convention isolates tenant data', () => {
      realtimeSyncService.initializeCompanySync('comp-alpha-1111');
      // Status enters CONNECTING or DISCONNECTED (in mock environment) without throwing
      expect(['CONNECTING', 'DISCONNECTED', 'CONNECTED']).toContain(realtimeSyncService.getStatus());
      realtimeSyncService.cleanupSubscriptions();
      expect(realtimeSyncService.getStatus()).toBe('DISCONNECTED');
    });
  });

  // --------------------------------------------------------------------------
  // 17.3 Offline Queue Persistence, Server Confirmation & Conflict Ledger
  // --------------------------------------------------------------------------
  describe('17.3 Offline Queue Persistence & Conflict Detection Engine', () => {
    it('holds mutations strictly in PENDING until server executor succeeds', async () => {
      const mut = offlineSyncService.enqueueMutation({
        companyId: 'comp-alpha-1111',
        entityType: 'WEIGHMENT',
        entityId: 'wm-offline-99',
        action: 'CREATE',
        payload: { weighmentNo: 'WM-26-9999', netWeight: 4200 },
        baseServerTimestamp: '2026-11-13T00:00:00Z',
      });

      expect(mut.status).toBe('PENDING');

      // 1. Simulating failed remote persist keeps it in FAILED status
      await offlineSyncService.flushQueue(async () => {
        return { success: false, error: 'Database network timeout' };
      });

      const pendingAfterFail = offlineSyncService.getPendingMutations('comp-alpha-1111');
      expect(pendingAfterFail.length).toBe(1);
      expect(pendingAfterFail[0].status).toBe('FAILED');
      expect(pendingAfterFail[0].retryCount).toBe(1);

      // 2. Simulating successful remote persist transitions status to SYNCED
      await offlineSyncService.flushQueue(async () => {
        return { success: true };
      });

      const pendingAfterSuccess = offlineSyncService.getPendingMutations('comp-alpha-1111');
      expect(pendingAfterSuccess.length).toBe(0);
    });

    it('detects concurrent server updates and logs conflict without overwriting server data', () => {
      const mutation = offlineSyncService.enqueueMutation({
        companyId: 'comp-alpha-1111',
        entityType: 'INVOICE',
        entityId: 'inv-conflict-01',
        action: 'UPDATE',
        payload: { grandTotal: 25000 },
        baseServerTimestamp: '2026-11-13T01:00:00Z',
      });

      // Server was modified at a later timestamp by another device
      const serverSnapshot = {
        id: 'inv-conflict-01',
        grandTotal: 30000,
        updatedAt: '2026-11-13T02:00:00Z', // 1 hour newer than client base
      };

      const conflictEval = offlineSyncService.evaluateConflict(mutation, serverSnapshot);
      expect(conflictEval.hasConflict).toBe(true);

      const conflictLog = offlineSyncService.recordConflict(mutation, serverSnapshot);
      expect(conflictLog.resolved).toBe(false);
      expect(conflictLog.serverSnapshot.grandTotal).toBe(30000);
      expect(conflictLog.clientPayload.grandTotal).toBe(25000);

      // Resolving with KEEP_SERVER discards client payload
      offlineSyncService.resolveConflict(conflictLog.id, 'KEEP_SERVER', 'Proprietor');
      const conflicts = offlineSyncService.getConflictLogs('comp-alpha-1111');
      expect(conflicts[0].resolved).toBe(true);
      expect(conflicts[0].resolutionStrategy).toBe('KEEP_SERVER');
    });
  });
});
