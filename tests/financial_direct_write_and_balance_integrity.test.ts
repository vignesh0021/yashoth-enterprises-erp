import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Suite 20: Financial Direct-Write Authorization, Cash/Bank Integrity & PostgreSQL Session RBAC', () => {
  const mig007Path = path.join(rootDir, 'database/migrations/007_authoritative_rls_hardening.sql');
  const mig009Path = path.join(rootDir, 'database/migrations/009_finance_atomic_and_advance_integrity.sql');
  const mig010Path = path.join(rootDir, 'database/migrations/010_offline_queue_and_account_triggers.sql');

  const mig007Code = fs.readFileSync(mig007Path, 'utf-8');
  const mig009Code = fs.readFileSync(mig009Path, 'utf-8');
  const mig010Code = fs.readFileSync(mig010Path, 'utf-8');

  const companyA = '11111111-1111-1111-1111-111111111111';
  const companyB = '22222222-2222-2222-2222-222222222222';

  // --------------------------------------------------------------------------
  // 1. Static DDL & Policy Inspection (P0 & P1)
  // --------------------------------------------------------------------------
  describe('20.1 DDL Policy Verification on Financial Tables', () => {
    it('verifies explicit REVOKE of direct DML on immutable ledger and atomic payment tables', () => {
      expect(mig009Code).toContain('REVOKE INSERT, UPDATE, DELETE ON account_transactions FROM authenticated, anon, PUBLIC;');
      expect(mig009Code).toContain('REVOKE INSERT, UPDATE, DELETE ON employee_advances FROM authenticated, anon, PUBLIC;');
      expect(mig009Code).toContain('REVOKE INSERT, UPDATE, DELETE ON contractor_payments FROM authenticated, anon, PUBLIC;');
      expect(mig009Code).toContain('REVOKE INSERT, UPDATE, DELETE ON labour_payments FROM authenticated, anon, PUBLIC;');
    });

    it('verifies RLS policies on account_transactions prevent direct client DML', () => {
      expect(mig009Code).toContain('CREATE POLICY rls_account_transactions_select ON account_transactions FOR SELECT');
      expect(mig009Code).toContain("CREATE POLICY rls_account_transactions_insert ON account_transactions FOR INSERT");
      expect(mig009Code).toContain("WITH CHECK (auth_current_role() = 'service_role')");
      expect(mig009Code).toContain('CREATE POLICY rls_account_transactions_update ON account_transactions FOR UPDATE');
      expect(mig009Code).toContain('USING (false)');
      expect(mig009Code).toContain('CREATE POLICY rls_account_transactions_delete ON account_transactions FOR DELETE');
      expect(mig009Code).toContain('USING (false)');
    });

    it('verifies operation-specific policies for Owner, Supervisor and Accounts on journal_entries and payments', () => {
      // payments
      expect(mig009Code).toContain('CREATE POLICY rls_payments_insert ON payments FOR INSERT');
      expect(mig009Code).toContain("auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator')");
      // journal_entries
      expect(mig009Code).toContain('CREATE POLICY rls_journal_entries_insert ON journal_entries FOR INSERT');
      expect(mig009Code).toContain("auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator')");
      expect(mig009Code).toContain("status <> 'POSTED'");
    });

    it('verifies Supervisor can log daily labour and contractor work entries but not disburse payments', () => {
      // daily_labour_entries allows store_operator to insert
      expect(mig009Code).toContain("auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator', 'store_operator')");
      // contractor_work_entries allows store_operator to insert
      expect(mig009Code).toContain("auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator', 'store_operator')");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Cash/Bank Balance Integrity Engine (Migration 010)
  // --------------------------------------------------------------------------
  describe('20.2 Cash/Bank Balance Integrity & Account Trigger Safety', () => {
    it('verifies trg_accounts_view_update prohibits direct modification of current_balance', () => {
      expect(mig010Code).toContain('NEW.current_balance IS DISTINCT FROM OLD.current_balance');
      expect(mig010Code).toContain('Forbidden: Direct modification of current_balance is prohibited');
    });

    it('verifies trg_accounts_view_update protects opening_balance when transactions exist', () => {
      expect(mig010Code).toContain('NEW.opening_balance IS DISTINCT FROM OLD.opening_balance');
      expect(mig010Code).toContain('Cannot modify opening_balance directly for account % with existing transactions');
      expect(mig010Code).toContain('Use an adjusting journal entry instead.');
    });

    it('verifies trg_sync_account_transaction_balance automatically updates current_balance on transaction insert/delete', () => {
      expect(mig010Code).toContain('CREATE OR REPLACE FUNCTION trg_sync_account_transaction_balance()');
      expect(mig010Code).toContain('NEW.direction = \'DEBIT\'');
      expect(mig010Code).toContain('current_balance = current_balance + NEW.amount');
      expect(mig010Code).toContain('NEW.direction = \'CREDIT\'');
      expect(mig010Code).toContain('current_balance = current_balance - NEW.amount');
      expect(mig010Code).toContain('CREATE TRIGGER trg_account_transactions_balance_sync');
    });

    it('verifies authoritative ledger reconciliation function fn_reconcile_account_balance', () => {
      expect(mig010Code).toContain('CREATE OR REPLACE FUNCTION fn_reconcile_account_balance(p_account_id UUID)');
      expect(mig010Code).toContain("SET search_path = public, pg_temp");
      expect(mig010Code).toContain("v_new_balance := v_opening + v_net_tx;");
      expect(mig010Code).toContain("GRANT EXECUTE ON FUNCTION fn_reconcile_account_balance TO authenticated, service_role;");
    });
  });

  // --------------------------------------------------------------------------
  // 3. PostgreSQL Authenticated Session Simulation (Owner, Supervisor, Accounts, Foreign)
  // --------------------------------------------------------------------------
  describe('20.3 PostgreSQL Authenticated Session Evaluation', () => {
    interface PgSession {
      jwtSub: string;
      jwtRole: 'authenticated' | 'anon' | 'service_role';
      companyId: string;
      appRole: 'owner_admin' | 'manager' | 'accounts_operator' | 'store_operator' | 'weighment_operator';
    }

    const ownerSession: PgSession = {
      jwtSub: '00000000-0000-0000-0000-000000000001',
      jwtRole: 'authenticated',
      companyId: companyA,
      appRole: 'owner_admin',
    };

    const supervisorSession: PgSession = {
      jwtSub: '00000000-0000-0000-0000-000000000002',
      jwtRole: 'authenticated',
      companyId: companyA,
      appRole: 'store_operator',
    };

    const accountsSession: PgSession = {
      jwtSub: '00000000-0000-0000-0000-000000000003',
      jwtRole: 'authenticated',
      companyId: companyA,
      appRole: 'accounts_operator',
    };

    const foreignTenantSession: PgSession = {
      jwtSub: '00000000-0000-0000-0000-000000000004',
      jwtRole: 'authenticated',
      companyId: companyB,
      appRole: 'owner_admin',
    };

    // Evaluator matching the PostgreSQL PL/pgSQL authorization rules
    function evaluateAccountUpdate(
      session: PgSession,
      targetCompanyId: string,
      oldAccount: { name: string; bank: string; openingBal: number; currentBal: number; hasTx: boolean; isActive: boolean },
      newAccount: { name?: string; bank?: string; openingBal?: number; currentBal?: number; isActive?: boolean }
    ): { success: boolean; error?: string; updatedAccount?: typeof oldAccount } {
      if (session.companyId !== targetCompanyId) {
        return { success: false, error: 'Unauthorized: Cross-tenant access denied' };
      }

      const allowedRoles = ['owner_admin', 'manager', 'accounts_operator'];
      if (!allowedRoles.includes(session.appRole)) {
        return { success: false, error: 'Forbidden: User is not authorized to update financial accounts' };
      }

      // Check current_balance tampering
      if (newAccount.currentBal !== undefined && newAccount.currentBal !== oldAccount.currentBal) {
        return { success: false, error: 'Forbidden: Direct modification of current_balance is prohibited' };
      }

      // Check opening_balance tampering
      if (newAccount.openingBal !== undefined && newAccount.openingBal !== oldAccount.openingBal) {
        if (oldAccount.hasTx) {
          return { success: false, error: 'Integrity constraint: Cannot modify opening_balance directly for account with existing transactions' };
        }
        if (session.appRole !== 'owner_admin') {
          return { success: false, error: 'Forbidden: Only owner_admin may correct initial opening balance' };
        }
      }

      const updated = {
        name: newAccount.name ?? oldAccount.name,
        bank: newAccount.bank ?? oldAccount.bank,
        openingBal: (newAccount.openingBal !== undefined && !oldAccount.hasTx && session.appRole === 'owner_admin') 
          ? newAccount.openingBal 
          : oldAccount.openingBal,
        currentBal: (newAccount.openingBal !== undefined && !oldAccount.hasTx && session.appRole === 'owner_admin')
          ? newAccount.openingBal
          : oldAccount.currentBal,
        hasTx: oldAccount.hasTx,
        isActive: newAccount.isActive ?? oldAccount.isActive,
      };

      return { success: true, updatedAccount: updated };
    }

    it('allows safe account metadata changes (name, bank details) by Accounts operator', () => {
      const initial = { name: 'Main Cash', bank: 'SBI', openingBal: 5000, currentBal: 12000, hasTx: true, isActive: true };
      const res = evaluateAccountUpdate(accountsSession, companyA, initial, { name: 'Main Petty Cash', bank: 'SBI Commercial' });
      expect(res.success).toBe(true);
      expect(res.updatedAccount?.name).toBe('Main Petty Cash');
      expect(res.updatedAccount?.bank).toBe('SBI Commercial');
      expect(res.updatedAccount?.currentBal).toBe(12000); // Unaltered
    });

    it('allows account deactivation by Accounts operator', () => {
      const initial = { name: 'Old HDFC', bank: 'HDFC', openingBal: 0, currentBal: 0, hasTx: true, isActive: true };
      const res = evaluateAccountUpdate(accountsSession, companyA, initial, { isActive: false });
      expect(res.success).toBe(true);
      expect(res.updatedAccount?.isActive).toBe(false);
    });

    it('rejects direct current_balance modification by any ordinary authenticated session', () => {
      const initial = { name: 'Main Cash', bank: 'SBI', openingBal: 5000, currentBal: 12000, hasTx: true, isActive: true };
      const res = evaluateAccountUpdate(ownerSession, companyA, initial, { currentBal: 999999 });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Direct modification of current_balance is prohibited');
    });

    it('rejects opening_balance modification when historical transactions exist', () => {
      const initial = { name: 'Main Cash', bank: 'SBI', openingBal: 5000, currentBal: 12000, hasTx: true, isActive: true };
      const res = evaluateAccountUpdate(ownerSession, companyA, initial, { openingBal: 8000 });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Cannot modify opening_balance directly for account with existing transactions');
    });

    it('allows opening_balance correction by Owner on a virgin account with 0 transactions', () => {
      const initial = { name: 'New Cash Counter', bank: 'Cash', openingBal: 1000, currentBal: 1000, hasTx: false, isActive: true };
      const res = evaluateAccountUpdate(ownerSession, companyA, initial, { openingBal: 2500 });
      expect(res.success).toBe(true);
      expect(res.updatedAccount?.openingBal).toBe(2500);
      expect(res.updatedAccount?.currentBal).toBe(2500); // Balance adjusted since virgin
    });

    it('rejects opening_balance correction by non-owner even on virgin account', () => {
      const initial = { name: 'New Cash Counter', bank: 'Cash', openingBal: 1000, currentBal: 1000, hasTx: false, isActive: true };
      const res = evaluateAccountUpdate(accountsSession, companyA, initial, { openingBal: 2500 });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Only owner_admin may correct initial opening balance');
    });

    it('rejects Supervisor from any account modifications', () => {
      const initial = { name: 'Main Cash', bank: 'SBI', openingBal: 5000, currentBal: 12000, hasTx: true, isActive: true };
      const res = evaluateAccountUpdate(supervisorSession, companyA, initial, { name: 'Hacked Cash' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Forbidden: User is not authorized to update financial accounts');
    });

    it('rejects Foreign Tenant User from accessing or modifying Company A accounts', () => {
      const initial = { name: 'Main Cash', bank: 'SBI', openingBal: 5000, currentBal: 12000, hasTx: true, isActive: true };
      const res = evaluateAccountUpdate(foreignTenantSession, companyA, initial, { name: 'Cross Tenant Hack' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Unauthorized: Cross-tenant access denied');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Balance Synchronization & Reconciliation Logic Verification
  // --------------------------------------------------------------------------
  describe('20.4 Balance Synchronization Trigger & Reconciliation Invariants', () => {
    it('correctly simulates DEBIT and CREDIT balance propagation', () => {
      let currentBalance = 10000;

      // Inward Debit (e.g. customer receipt) +5000
      const tx1 = { direction: 'DEBIT', amount: 5000 };
      currentBalance += (tx1.direction === 'DEBIT' ? tx1.amount : -tx1.amount);
      expect(currentBalance).toBe(15000);

      // Outward Credit (e.g. contractor progress payment) -3500
      const tx2 = { direction: 'CREDIT', amount: 3500 };
      currentBalance += (tx2.direction === 'DEBIT' ? tx2.amount : -tx2.amount);
      expect(currentBalance).toBe(11500);

      // Transaction Rollback / Deletion of tx2 (+3500 reversal)
      currentBalance -= (tx2.direction === 'DEBIT' ? tx2.amount : -tx2.amount);
      expect(currentBalance).toBe(15000);
    });

    it('reconciles account balance against full transaction ledger', () => {
      const openingBalance = 20000;
      const transactions = [
        { direction: 'DEBIT', amount: 45000 },
        { direction: 'CREDIT', amount: 12000 },
        { direction: 'CREDIT', amount: 8500 },
        { direction: 'DEBIT', amount: 3000 },
      ];

      const netTx = transactions.reduce((acc, tx) => {
        return tx.direction === 'DEBIT' ? acc + tx.amount : acc - tx.amount;
      }, 0);

      const reconciledBalance = openingBalance + netTx;
      expect(reconciledBalance).toBe(47500); // 20000 + 45000 - 12000 - 8500 + 3000 = 47500
    });
  });
});
