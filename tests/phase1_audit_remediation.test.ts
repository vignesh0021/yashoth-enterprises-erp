import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { dbRepository } from '../src/services/databaseRepository.ts';
import { teamSyncService, MASTER_VAULT_ID, OFFICIAL_SYNC_EMAIL } from '../src/services/teamSyncService.ts';

describe('Suite 15: Phase 1 Forensic Remediation & Architecture Integrity', () => {
  const root = process.cwd();

  it('15.1 verifies router alias and Dashboard navigation fix for /accounts', () => {
    const routerPath = path.join(root, 'src/app/router.tsx');
    const routerCode = fs.readFileSync(routerPath, 'utf-8');
    expect(routerCode).toContain("path: 'accounts'");
    expect(routerCode).toContain('element: <FinanceView />');

    const dashboardPath = path.join(root, 'src/modules/dashboard/DashboardView.tsx');
    const dashboardCode = fs.readFileSync(dashboardPath, 'utf-8');
    expect(dashboardCode).toContain("navigate('/finance?tab=CASH_BANK')");
    expect(dashboardCode).not.toContain("navigate('/accounts')");

    const financePath = path.join(root, 'src/modules/finance/FinanceView.tsx');
    const financeCode = fs.readFileSync(financePath, 'utf-8');
    expect(financeCode).toContain("tabParam === 'CASH_BANK'");
  });

  it('15.2 verifies DatabaseRepository implements authoritative cash & bank account CRUD methods', () => {
    expect(typeof dbRepository.fetchAccounts).toBe('function');
    expect(typeof dbRepository.saveAccount).toBe('function');
    expect(typeof dbRepository.updateAccount).toBe('function');
    expect(typeof dbRepository.deleteAccount).toBe('function');
  });

  it('15.3 verifies complete removal of public mock API (api.restful-api.dev) from teamSyncService', () => {
    const syncServicePath = path.join(root, 'src/services/teamSyncService.ts');
    const syncServiceCode = fs.readFileSync(syncServicePath, 'utf-8');

    // Strict zero-tolerance for mock API data leakage
    expect(syncServiceCode).not.toContain('api.restful-api.dev');
    expect(MASTER_VAULT_ID).toBe('ff808181a09d98f701a1c56d14f07de2');
    expect(OFFICIAL_SYNC_EMAIL).toBe('yashothenterprises44@gmail.com');
    expect(teamSyncService.getVaultId()).toBe('ff808181a09d98f701a1c56d14f07de2');
  });

  it('15.4 verifies PostgreSQL Migration 010 schema definitions', () => {
    const mig010Path = path.join(root, 'database/migrations/010_offline_queue_and_account_triggers.sql');
    expect(fs.existsSync(mig010Path)).toBe(true);

    const mig010Code = fs.readFileSync(mig010Path, 'utf-8');
    expect(mig010Code).toContain('CREATE TABLE IF NOT EXISTS offline_sync_queue');
    expect(mig010Code).toContain('CREATE TABLE IF NOT EXISTS sync_conflicts');
    expect(mig010Code).toContain('trg_accounts_view_update');
    expect(mig010Code).toContain('accounts_view_update_trigger');
    expect(mig010Code).toContain('fn_get_next_voucher_no');
    expect(mig010Code).toContain('ENABLE ROW LEVEL SECURITY');
  });
});
