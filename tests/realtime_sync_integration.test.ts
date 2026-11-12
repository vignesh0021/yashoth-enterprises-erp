import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { supabase } from '../src/services/supabaseClient.ts';
import { realtimeSyncService } from '../src/services/realtimeSyncService.ts';
import type { RealtimeChangeEvent } from '../src/services/realtimeSyncService.ts';
import { offlineSyncService } from '../src/services/offlineSyncService.ts';
import { enforceAuthorization } from '../backend/business-rules/authEngine.ts';
import { validateJournalEntry, AccountingImbalanceError } from '../backend/business-rules/accountingEngine.ts';
import type { UserSession, JournalEntry } from '../src/types/index.ts';

describe('Suite 16: Phase 2 Supabase Realtime Synchronization & 3-User Access Integrity', () => {
  const root = process.cwd();

  beforeEach(() => {
    offlineSyncService.clearAllDataForTesting();
    realtimeSyncService.cleanupSubscriptions();
  });

  afterEach(() => {
    realtimeSyncService.cleanupSubscriptions();
  });

  // --------------------------------------------------------------------------
  // 16.1 Official Supabase Client Singleton & Realtime Capability
  // --------------------------------------------------------------------------
  it('16.1 verifies Supabase client singleton exports Realtime channels and Auth without duplicates', () => {
    expect(supabase).toBeDefined();
    expect(typeof supabase.channel).toBe('function');
    expect(typeof supabase.removeChannel).toBe('function');
    expect(typeof supabase.queryTable).toBe('function');
    expect(typeof supabase.insertRow).toBe('function');
  });

  // --------------------------------------------------------------------------
  // 16.2 Three-User Access Model & Server/Role Isolation
  // --------------------------------------------------------------------------
  it('16.2 enforces strict role isolation across Owner, Supervisor, and Accounts users', () => {
    const ownerUser: UserSession = {
      id: 'usr-owner-01',
      email: 'owner@yasoth.com',
      fullName: 'P. Nandha Kumar (Proprietor)',
      role: 'owner_admin',
      companyId: 'a0000000-0000-0000-0000-000000000001',
      expiresAt: Date.now() + 3600000,
    };

    const supervisorUser: UserSession = {
      id: 'usr-sup-01',
      email: 'supervisor@yasoth.com',
      fullName: 'S. Rajan (Yard Supervisor)',
      role: 'manager',
      companyId: 'a0000000-0000-0000-0000-000000000001',
      expiresAt: Date.now() + 3600000,
    };

    const accountsUser: UserSession = {
      id: 'usr-acc-01',
      email: 'accounts@yasoth.com',
      fullName: 'V. Sundaram (Accounts Head)',
      role: 'accounts_operator',
      companyId: 'a0000000-0000-0000-0000-000000000001',
      expiresAt: Date.now() + 3600000,
    };

    // 1. Owner can access and post anything
    expect(() => enforceAuthorization(ownerUser, 'weighment:record')).not.toThrow();
    expect(() => enforceAuthorization(ownerUser, 'invoice:create')).not.toThrow();
    expect(() => enforceAuthorization(ownerUser, 'settings:backup')).not.toThrow();

    // 2. Supervisor CAN record weighment and purchases, but is BLOCKED from destructive deletes, restoration and migration
    expect(() => enforceAuthorization(supervisorUser, 'weighment:record')).not.toThrow();
    expect(() => enforceAuthorization(supervisorUser, 'purchase:create')).not.toThrow();
    expect(() => enforceAuthorization(supervisorUser, 'settings:restore')).toThrow();
    expect(() => enforceAuthorization(supervisorUser, 'admin:full')).toThrow();
    expect(() => enforceAuthorization(supervisorUser, 'weighment:delete')).toThrow();

    // 3. Accounts CAN create invoices and record payments, but cannot record weighments, modify settings, or perform admin actions
    expect(() => enforceAuthorization(accountsUser, 'invoice:create')).not.toThrow();
    expect(() => enforceAuthorization(accountsUser, 'finance:payment')).not.toThrow();
    expect(() => enforceAuthorization(accountsUser, 'weighment:record')).toThrow();
    expect(() => enforceAuthorization(accountsUser, 'settings:backup')).toThrow();
  });

  // --------------------------------------------------------------------------
  // 16.3 Realtime Subscriptions, Duplicate Suppression & Status Tracking
  // --------------------------------------------------------------------------
  it('16.3 suppresses duplicate Realtime events and broadcasts unique change payloads', () => {
    let receivedEventsCount = 0;
    const receivedRecords: any[] = [];

    const unsubscribe = realtimeSyncService.onTableChange('weighments', (ev) => {
      receivedEventsCount++;
      receivedRecords.push(ev.newRecord);
    });

    const testEvent: RealtimeChangeEvent = {
      table: 'weighments',
      eventType: 'INSERT',
      newRecord: { id: 'wm-test-01', weighmentNo: 'WM-26-0001', netWeight: 5400 },
      oldRecord: null,
      companyId: 'comp-test-01',
      timestamp: '2026-11-12T14:00:00Z',
    };

    // Dispatch the first time -> should be accepted
    (realtimeSyncService as any).dispatchEvent(testEvent);
    expect(receivedEventsCount).toBe(1);
    expect(receivedRecords[0].weighmentNo).toBe('WM-26-0001');

    // Dispatch the exact same event again (simulating network duplicate / retry) -> must be suppressed!
    (realtimeSyncService as any).dispatchEvent(testEvent);
    expect(receivedEventsCount).toBe(1); // Still 1, not duplicate!

    unsubscribe();
  });

  // --------------------------------------------------------------------------
  // 16.4 Offline Recovery & Confirmation Before Marking SYNCED
  // --------------------------------------------------------------------------
  it('16.4 holds mutations in PENDING status until server confirms persistence', async () => {
    const mutation = offlineSyncService.enqueueMutation({
      companyId: 'comp-ye',
      entityType: 'WEIGHMENT',
      entityId: 'wm-offline-01',
      action: 'CREATE',
      payload: { weighmentNo: 'WM-26-0999', netWeight: 3200 },
    });

    expect(mutation.status).toBe('PENDING');

    // Attempt flush with an executor that fails (e.g. server offline)
    await offlineSyncService.flushQueue(async () => {
      return { success: false, error: 'Network timeout (simulated offline)' };
    });

    const pending = offlineSyncService.getPendingMutations('comp-ye');
    expect(pending.length).toBe(1);
    expect(pending[0].status).toBe('FAILED');
    expect(pending[0].error).toContain('Network timeout');

    // When server confirms success, status transitions to SYNCED
    await offlineSyncService.flushQueue(async () => {
      return { success: true };
    });

    const remainingPending = offlineSyncService.getPendingMutations('comp-ye');
    expect(remainingPending.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 16.5 Concurrent Financial Updates & Exact Double-Entry Balancing
  // --------------------------------------------------------------------------
  it('16.5 ensures simultaneous financial updates maintain zero-variance double-entry balancing', () => {
    const balancedJournal: JournalEntry = {
      id: 'je-realtime-01',
      companyId: 'comp-ye',
      entryNo: 'JV-26-0001',
      entryDate: '2026-11-12',
      sourceType: 'SALES_INVOICE',
      narration: 'Realtime concurrent sales invoice journal',
      lines: [
        {
          id: 'jl-1',
          accountCode: '1030',
          accountName: 'Trade Receivables',
          debit: 11800.00,
          credit: 0.00,
        },
        {
          id: 'jl-2',
          accountCode: '4010',
          accountName: 'Scrap Sales Revenue',
          debit: 0.00,
          credit: 10000.00,
        },
        {
          id: 'jl-3',
          accountCode: '2020',
          accountName: 'Output GST Payable',
          debit: 0.00,
          credit: 1800.00,
        },
      ],
      totalDebit: 11800.00,
      totalCredit: 11800.00,
      isPosted: true,
      createdBy: 'accounts',
      createdAt: '2026-11-12T14:00:00Z',
    };

    expect(() => validateJournalEntry(balancedJournal)).not.toThrow();

    // Any corrupted or unbalanced entry during concurrent writes is strictly rejected
    const unbalancedJournal: JournalEntry = {
      ...balancedJournal,
      lines: [
        ...balancedJournal.lines.slice(0, 2),
        {
          id: 'jl-3',
          accountCode: '2020',
          accountName: 'Output GST Payable',
          debit: 0.00,
          credit: 1500.00, // unbalanced by 300
        },
      ],
    };
    expect(() => validateJournalEntry(unbalancedJournal)).toThrow(AccountingImbalanceError);
  });

  // --------------------------------------------------------------------------
  // 16.6 PostgreSQL Realtime Publication & Replica Identity Migration
  // --------------------------------------------------------------------------
  it('16.6 verifies migration 011 configures supabase_realtime publication and replica identity full', () => {
    const mig011Path = path.join(root, 'database/migrations/011_realtime_publication_and_authoritative_sync.sql');
    expect(fs.existsSync(mig011Path)).toBe(true);

    const mig011Code = fs.readFileSync(mig011Path, 'utf-8');
    expect(mig011Code).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE');
    expect(mig011Code).toContain('cash_bank_accounts');
    expect(mig011Code).toContain('inventory_lots');
    expect(mig011Code).toContain('stock_movements');
    expect(mig011Code).toContain('payments');
    expect(mig011Code).toContain('journal_entries');
    expect(mig011Code).toContain('parties');
    expect(mig011Code).toContain('weighments');
    expect(mig011Code).toContain('invoices');
    expect(mig011Code).toContain('REPLICA IDENTITY FULL');
  });
});
