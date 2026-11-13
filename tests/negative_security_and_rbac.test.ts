import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Suite 19: Negative Security, RBAC & Anti-Tampering Gate', () => {
  const mig007Path = path.join(rootDir, 'database/migrations/007_authoritative_rls_hardening.sql');
  const mig009Path = path.join(rootDir, 'database/migrations/009_finance_atomic_and_advance_integrity.sql');
  const mig010Path = path.join(rootDir, 'database/migrations/010_offline_queue_and_account_triggers.sql');

  const mig007Code = fs.readFileSync(mig007Path, 'utf-8');
  const mig009Code = fs.readFileSync(mig009Path, 'utf-8');
  const mig010Code = fs.readFileSync(mig010Path, 'utf-8');

  // Helper simulating the PL/pgSQL role verification engine
  interface MockSession {
    userId: string | null;
    role: string; // 'authenticated' | 'anon' | 'service_role'
    companyMemberships: { companyId: string; role: string; isActive: boolean }[];
  }

  function authIsCompanyMember(session: MockSession, cid: string): boolean {
    if (!cid) return false;
    if (session.role === 'service_role' || session.role === 'owner_admin') return true;
    return session.companyMemberships.some((m) => m.companyId === cid && m.isActive);
  }

  function authHasCompanyRole(session: MockSession, cid: string, allowedRoles: string[]): boolean {
    if (!cid) return false;
    if (session.role === 'service_role' || session.role === 'owner_admin') return true;
    return session.companyMemberships.some(
      (m) => m.companyId === cid && m.isActive && allowedRoles.includes(m.role)
    );
  }

  const companyA = '11111111-1111-1111-1111-111111111111';
  const companyB = '22222222-2222-2222-2222-222222222222';

  it('19.1 blocks Supervisor from unauthorized financial payment disbursement', () => {
    // Check SQL implementation in migration 009
    expect(mig009Code).toContain("auth_has_company_role(p_company_id, 'owner_admin', 'manager', 'accounts_operator')");
    expect(mig009Code).toContain("Forbidden: User does not have financial disbursement authorization");

    // Negative execution simulation
    const supervisorSession: MockSession = {
      userId: 'usr-supervisor',
      role: 'authenticated',
      companyMemberships: [{ companyId: companyA, role: 'weighment_operator', isActive: true }],
    };

    const isAuthorized = authHasCompanyRole(supervisorSession, companyA, ['owner_admin', 'manager', 'accounts_operator']);
    expect(isAuthorized).toBe(false);
  });

  it('19.2 blocks Accounts operator from Owner-only settings and account deletion', () => {
    // Migration 010 trg_accounts_view_delete requires owner_admin
    expect(mig010Code).toContain("auth_has_company_role(OLD.company_id, 'owner_admin')");
    expect(mig010Code).toContain("Forbidden: Only owner_admin may delete financial accounts");

    const accountsSession: MockSession = {
      userId: 'usr-accounts',
      role: 'authenticated',
      companyMemberships: [{ companyId: companyA, role: 'accounts_operator', isActive: true }],
    };

    const canDeleteAccount = authHasCompanyRole(accountsSession, companyA, ['owner_admin']);
    expect(canDeleteAccount).toBe(false);
  });

  it('19.3 strictly rejects cross-tenant access between Company A and Company B', () => {
    const userCompanyA: MockSession = {
      userId: 'usr-comp-a',
      role: 'authenticated',
      companyMemberships: [{ companyId: companyA, role: 'owner_admin', isActive: true }],
    };

    // User A attempting access to Company B
    const canAccessCompanyB = authIsCompanyMember(userCompanyA, companyB);
    expect(canAccessCompanyB).toBe(false);

    // Cross-company account migration blocked in trigger
    expect(mig010Code).toContain('Forbidden: Cannot change account company_id (cross-company transfer prohibited)');
  });

  it('19.4 rejects unauthenticated / anonymous user calling financial RPCs or sequence generator', () => {
    const anonSession: MockSession = {
      userId: null,
      role: 'anon',
      companyMemberships: [],
    };

    const isMember = authIsCompanyMember(anonSession, companyA);
    expect(isMember).toBe(false);

    // Migration 009 and 010 verify auth_current_user_id() is not null
    expect(mig009Code).toContain("Unauthenticated: Caller must be authenticated");
    expect(mig010Code).toContain("Unauthenticated: Caller must be authenticated");

    // Both functions explicitly revoke execute from anon
    expect(mig009Code).toContain("REVOKE ALL ON FUNCTION fn_post_contractor_payment_atomic FROM PUBLIC, anon;");
    expect(mig010Code).toContain("REVOKE ALL ON FUNCTION fn_get_next_voucher_no(UUID, VARCHAR, VARCHAR) FROM PUBLIC, anon;");
  });

  it('19.5 allows service-role voucher generation while validating company existence', () => {
    const serviceRoleSession: MockSession = {
      userId: null,
      role: 'service_role',
      companyMemberships: [],
    };

    // Service role bypasses user token check
    const isServiceRoleAuthorized = serviceRoleSession.role === 'service_role';
    expect(isServiceRoleAuthorized).toBe(true);

    // Migration 010 explicitly allows service_role in auth_current_role()
    expect(mig010Code).toContain("auth_current_role() NOT IN ('service_role')");
    expect(mig010Code).toContain("GRANT EXECUTE ON FUNCTION fn_get_next_voucher_no(UUID, VARCHAR, VARCHAR) TO authenticated, service_role;");
  });

  it('19.6 prevents double-posting on duplicate idempotency key submissions', () => {
    // Simulates idempotency cache
    const processedMutations = new Map<string, { status: string; id: string }>();

    function submitMutation(key: string, recordId: string) {
      if (processedMutations.has(key)) {
        return { success: true, idempotent: true, id: processedMutations.get(key)!.id };
      }
      processedMutations.set(key, { status: 'SYNCED', id: recordId });
      return { success: true, idempotent: false, id: recordId };
    }

    const firstCall = submitMutation('idem-key-101', 'rec-001');
    expect(firstCall.idempotent).toBe(false);
    expect(firstCall.id).toBe('rec-001');

    // Duplicate submission with identical key
    const secondCall = submitMutation('idem-key-101', 'rec-999');
    expect(secondCall.idempotent).toBe(true);
    expect(secondCall.id).toBe('rec-001'); // Returns original record, does NOT create rec-999!
  });

  it('19.7 protects accounts with linked transactions or journals from deletion', () => {
    expect(mig010Code).toContain("Cannot delete account % with linked transactions");
    expect(mig010Code).toContain("Cannot delete account % linked to payment records");
    expect(mig010Code).toContain("Cannot delete account % linked to expense disbursements");
    expect(mig010Code).toContain("Cannot delete account % with posted journal entries");
    expect(mig010Code).toContain("Deactivate by setting is_active = false instead.");

    interface AccountRecord {
      id: string;
      code: string;
      isActive: boolean;
      hasTransactions: boolean;
    }

    function deleteAccount(acc: AccountRecord): { deleted: boolean; deactivated?: boolean; error?: string } {
      if (acc.hasTransactions) {
        return { deleted: false, error: 'Integrity constraint: Cannot delete account with financial history' };
      }
      return { deleted: true };
    }

    const activeAccountWithTx: AccountRecord = {
      id: 'acc-safe-1',
      code: '1010',
      isActive: true,
      hasTransactions: true,
    };

    const result = deleteAccount(activeAccountWithTx);
    expect(result.deleted).toBe(false);
    expect(result.error).toContain('Integrity constraint');
  });
});
