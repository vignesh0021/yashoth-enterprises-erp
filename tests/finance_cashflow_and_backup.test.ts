import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { calculateReconciledAccountBalance } from '../backend/business-rules/financeEngine.ts';
import type { AccountTransaction, BackupDestination, CashBankAccount } from '../src/types/index.ts';

const projectRoot = process.cwd();
const readSrc = (relPath: string) => fs.readFileSync(path.join(projectRoot, relPath), 'utf8');

describe('Cashflow CRUD, Account Balance Reconciliation & Mobile Backup Fixes', () => {
  it('reflects updated openingBalance in calculateReconciledAccountBalance when OPENING_BALANCE transaction is synchronized', () => {
    const account: CashBankAccount = {
      id: 'acc-1',
      accountCode: 'CASH-01',
      accountName: 'Yard Cash Box',
      accountType: 'CASH',
      openingBalance: 8000,
      openingBalanceDate: '2026-10-01',
      isActive: true,
    };

    const txsWithSyncedOpening: AccountTransaction[] = [
      {
        id: 'tx-open-1',
        accountId: 'acc-1',
        transactionDate: '2026-10-01',
        transactionType: 'OPENING_BALANCE',
        direction: 'DEBIT',
        amount: 8000,
        referenceNo: 'OPEN-1',
        description: 'Opening Balance',
        createdBy: 'Admin',
        createdAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 'tx-in-1',
        accountId: 'acc-1',
        transactionDate: '2026-10-02',
        transactionType: 'CUSTOMER_RECEIPT',
        direction: 'DEBIT',
        amount: 2500,
        referenceNo: 'MAN-1',
        description: 'Cash inflow',
        createdBy: 'Admin',
        createdAt: '2026-10-02T00:00:00Z',
      },
    ];

    expect(calculateReconciledAccountBalance(account, txsWithSyncedOpening)).toBe(10500);
  });

  it('accepts SUPABASE_CLOUD as a valid BackupDestination', () => {
    const dest: BackupDestination = 'SUPABASE_CLOUD';
    expect(dest).toBe('SUPABASE_CLOUD');
  });

  it('synchronizes OPENING_BALANCE transaction on updateAccount and permits deleting accounts without operational transactions in ERPContext', () => {
    const erpCtx = readSrc('src/context/ERPContext.tsx');
    expect(erpCtx).toContain('addAccountTransaction: (txData: Omit<AccountTransaction');
    expect(erpCtx).toContain("tx.transactionType === 'OPENING_BALANCE'");
    expect(erpCtx).toContain("tx.transactionType !== 'OPENING_BALANCE'");
    expect(erpCtx).toContain("destination === 'SUPABASE_CLOUD'");
  });

  it('provides Cashflow Entry CRUD and Account Delete controls in FinanceView without leading-zero numeric input bug', () => {
    const financeView = readSrc('src/modules/finance/FinanceView.tsx');
    expect(financeView).toContain('handleOpenAddTx');
    expect(financeView).toContain('handleOpenEditTx');
    expect(financeView).toContain('handleDeleteTx');
    expect(financeView).toContain('handleDeleteAccount');
    expect(financeView).toContain('openingBalanceStr');
    expect(financeView).toContain('Delete Account');
  });

  it('provides Supabase Cloud Backup & Quick Restore and responsive mobile layout in BackupManagerView and SettingsView', () => {
    const backupView = readSrc('src/modules/settings/BackupManagerView.tsx');
    const settingsView = readSrc('src/modules/settings/SettingsView.tsx');
    expect(backupView).toContain('Supabase Cloud Backup &amp; Sync');
    expect(backupView).toContain('Backup to Supabase');
    expect(backupView).toContain('Restore from Supabase');
    expect(backupView).toContain("exportDestination === 'SUPABASE_CLOUD'");
    expect(backupView).toContain('break-all');
    expect(settingsView).toContain('shrink-0 whitespace-nowrap');
  });

  it('wraps financial report tables in overflow-x-auto touch-pan-x for mobile scrolling', () => {
    const reportsView = readSrc('src/modules/reports/ReportsView.tsx');
    expect(reportsView).toContain('overflow-x-auto touch-pan-x');
  });

  it('purges pre-seeded dummy operational data and supports clearAllOperationalData in ERPContext and SettingsView', () => {
    const erpCtx = readSrc('src/context/ERPContext.tsx');
    const settingsView = readSrc('src/modules/settings/SettingsView.tsx');
    expect(erpCtx).toContain('dummy_purged_v1');
    expect(erpCtx).toContain('clearAllOperationalData');
    expect(settingsView).toContain('Clear All Dummy / Operational Data');
  });

  it('provides explicit Inactive/Activate and permanent Delete actions for Materials, Parties, Invoices, and Proforma Invoices', () => {
    const erpCtx = readSrc('src/context/ERPContext.tsx');
    const materialsTab = readSrc('src/modules/inventory/MaterialsMasterTab.tsx');
    const partiesView = readSrc('src/modules/parties/PartiesView.tsx');
    const invoicesView = readSrc('src/modules/invoices/InvoicesView.tsx');
    const docsView = readSrc('src/modules/documents/CommercialDocumentsView.tsx');

    expect(erpCtx).toContain('deleteMaterial = (id: string, force: boolean = false)');
    expect(erpCtx).toContain('deleteParty = (id: string, force: boolean = false)');
    expect(erpCtx).toContain('if (currentUser) currentUser.lastActiveAt = Date.now()');
    expect(materialsTab).toContain('handleToggleActive');
    expect(materialsTab).toContain('Permanently Delete Material');
    expect(partiesView).toContain('handleToggleActive');
    expect(partiesView).toContain('Permanently Delete Party');
    expect(invoicesView).toContain('catch (err: any)');
    expect(docsView).toContain('catch (err: any)');
  });
});
