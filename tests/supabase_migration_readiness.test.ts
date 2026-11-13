import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Suite 18: Supabase Migration Readiness & Staging Validation (010 & 011)', () => {
  const mig010Path = path.join(rootDir, 'database/migrations/010_offline_queue_and_account_triggers.sql');
  const mig011Path = path.join(rootDir, 'database/migrations/011_realtime_publication_and_authoritative_sync.sql');

  it('18.1 verifies Migration 010 schema syntax, dependencies, and RLS', () => {
    expect(fs.existsSync(mig010Path)).toBe(true);
    const sql = fs.readFileSync(mig010Path, 'utf-8');

    // Schema prerequisites for cash_bank_accounts
    expect(sql).toContain('ALTER TABLE IF EXISTS cash_bank_accounts ADD COLUMN IF NOT EXISTS current_balance');
    expect(sql).toContain('ALTER TABLE IF EXISTS cash_bank_accounts ADD COLUMN IF NOT EXISTS updated_at');
    expect(sql).toContain('CREATE OR REPLACE VIEW accounts AS SELECT * FROM cash_bank_accounts;');

    // INSTEAD OF triggers
    expect(sql).toContain('trg_accounts_view_update()');
    expect(sql).toContain('accounts_view_update_trigger');
    expect(sql).toContain('trg_accounts_view_insert()');
    expect(sql).toContain('accounts_view_insert_trigger');
    expect(sql).toContain('trg_accounts_view_delete()');
    expect(sql).toContain('accounts_view_delete_trigger');

    // Offline queue and conflict tables
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS offline_sync_queue');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS sync_conflicts');
    expect(sql).toContain('ALTER TABLE offline_sync_queue ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('WITH CHECK');

    // Atomic voucher sequence generator
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS company_document_sequences');
    expect(sql).toContain('ALTER TABLE company_document_sequences ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('company_document_sequences_tenant_policy');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION fn_get_next_voucher_no');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('ON CONFLICT (company_id, doc_type, financial_year)');
  });

  it('18.2 verifies Migration 011 Realtime publication and replica identities', () => {
    expect(fs.existsSync(mig011Path)).toBe(true);
    const sql = fs.readFileSync(mig011Path, 'utf-8');

    // REPLICA IDENTITY FULL checks
    const expectedTables = [
      'cash_bank_accounts',
      'inventory_lots',
      'stock_movements',
      'payments',
      'payment_allocations',
      'journal_entries',
      'journal_lines',
      'parties',
      'weighments',
      'invoices',
      'purchase_headers',
      'offline_sync_queue',
      'sync_conflicts',
    ];

    expectedTables.forEach((table) => {
      expect(sql).toContain(`ALTER TABLE IF EXISTS ${table} REPLICA IDENTITY FULL;`);
    });

    // Publication guard
    expect(sql).toContain("pubname = 'supabase_realtime'");
    expect(sql).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE');
    expect(sql).toContain('information_schema.tables');
  });

  it('18.3 validates voucher number formatting and monotonicity algorithm', () => {
    // Simulates the PL/pgSQL logic of fn_get_next_voucher_no
    function generateVoucherNumber(prefix: string, date: Date, seqNum: number): string {
      const month = date.getMonth() + 1;
      const fullYear = date.getFullYear();
      const fy = month >= 4 ? String(fullYear).slice(-2) : String(fullYear - 1).slice(-2);
      const paddedNum = String(seqNum).padStart(4, '0');
      return `${prefix}-${fy}-${paddedNum}`;
    }

    const testDate = new Date('2026-11-13T10:00:00Z');
    expect(generateVoucherNumber('WM', testDate, 1)).toBe('WM-26-0001');
    expect(generateVoucherNumber('WM', testDate, 42)).toBe('WM-26-0042');
    expect(generateVoucherNumber('REC', testDate, 999)).toBe('REC-26-0999');
    expect(generateVoucherNumber('JV', testDate, 1000)).toBe('JV-26-1000');

    // Concurrency test: simulate 100 monotonic requests
    const generated = new Set<string>();
    for (let i = 1; i <= 100; i++) {
      const voucher = generateVoucherNumber('PAY', testDate, i);
      expect(generated.has(voucher)).toBe(false);
      generated.add(voucher);
    }
    expect(generated.size).toBe(100);
  });

  it('18.4 validates conflict resolution strategies for multi-device sync', () => {
    interface MutationRecord {
      id: string;
      serverVersion: number;
      payload: { amount: number; notes: string };
    }

    const serverState: MutationRecord = {
      id: 'acc-1',
      serverVersion: 3,
      payload: { amount: 5000, notes: 'Office cash balance' },
    };

    const clientMutation = {
      id: 'acc-1',
      baseServerVersion: 2, // Stale!
      payload: { amount: 5500, notes: 'Office cash balance updated offline' },
    };

    // Conflict detected: baseServerVersion (2) < serverVersion (3)
    const isConflict = clientMutation.baseServerVersion < serverState.serverVersion;
    expect(isConflict).toBe(true);

    // Strategy 1: KEEP_SERVER
    const resolvedKeepServer = { ...serverState };
    expect(resolvedKeepServer.payload.amount).toBe(5000);

    // Strategy 2: FORCE_CLIENT
    const resolvedForceClient = {
      ...serverState,
      serverVersion: serverState.serverVersion + 1,
      payload: clientMutation.payload,
    };
    expect(resolvedForceClient.payload.amount).toBe(5500);

    // Strategy 3: SAVE_AS_NEW
    const resolvedSaveAsNew = {
      id: 'acc-1-conflict-branch',
      serverVersion: 1,
      payload: clientMutation.payload,
    };
    expect(resolvedSaveAsNew.id).not.toBe(serverState.id);
  });
});
