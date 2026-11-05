// Authentication, RBAC & Security Test Suite
import { describe, it, expect } from 'vitest';
import { 
  hasPermission, 
  enforceAuthorization, 
  hashPassword, 
  isSessionExpired, 
  AuthorizationError,
  createSecurityAuditLog,
  SESSION_INACTIVITY_TIMEOUT_MS 
} from '../backend/business-rules/authEngine.ts';
import type { UserRole, UserSession } from '../src/types/index.ts';

describe('Security, Authentication & RBAC Engine', () => {
  const companyA = 'a0000000-0000-0000-0000-000000000001';
  const companyB = 'b0000000-0000-0000-0000-000000000002';

  const adminSession: UserSession = {
    id: 'usr-admin-01',
    email: 'admin@yasoth.com',
    fullName: 'Admin User',
    role: 'owner_admin',
    companyId: companyA,
    token: 'tok-admin',
    expiresAt: Date.now() + 3600 * 1000,
    lastActiveAt: Date.now(),
  };

  const managerSession: UserSession = {
    id: 'usr-mgr-01',
    email: 'manager@yasoth.com',
    fullName: 'Yard Manager',
    role: 'manager',
    companyId: companyA,
    token: 'tok-mgr',
    expiresAt: Date.now() + 3600 * 1000,
    lastActiveAt: Date.now(),
  };

  const auditorSession: UserSession = {
    id: 'usr-audit-01',
    email: 'auditor@yasoth.com',
    fullName: 'Internal Auditor',
    role: 'auditor',
    companyId: companyA,
    token: 'tok-audit',
    expiresAt: Date.now() + 3600 * 1000,
    lastActiveAt: Date.now(),
  };

  describe('Cryptographic Password Hashing', () => {
    it('produces deterministic SHA-256 hashes with salt', async () => {
      const hash1 = await hashPassword('Admin@123', 'TEST_SALT');
      const hash2 = await hashPassword('Admin@123', 'TEST_SALT');
      const hashDiff = await hashPassword('DifferentPassword', 'TEST_SALT');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hashDiff);
      expect(hash1.length).toBe(64); // 256 bits hex
    });
  });

  describe('Role-Based Access Control (RBAC) Permissions', () => {
    it('grants full operational and administrative permissions to owner_admin', () => {
      expect(hasPermission('owner_admin', 'purchase:post')).toBe(true);
      expect(hasPermission('owner_admin', 'sales:dispatch')).toBe(true);
      expect(hasPermission('owner_admin', 'invoice:delete')).toBe(true);
      expect(hasPermission('owner_admin', 'admin:full')).toBe(true);
      expect(hasPermission('owner_admin', 'settings:restore')).toBe(true);
    });

    it('grants operational posting but restricts destructive deletions for manager', () => {
      expect(hasPermission('manager', 'purchase:post')).toBe(true);
      expect(hasPermission('manager', 'sales:dispatch')).toBe(true);
      expect(hasPermission('manager', 'invoice:delete')).toBe(false);
      expect(hasPermission('manager', 'admin:full')).toBe(false);
      expect(hasPermission('manager', 'settings:restore')).toBe(false);
    });

    it('strictly confines auditor to read-only reporting access', () => {
      expect(hasPermission('auditor', 'reports:view')).toBe(true);
      expect(hasPermission('auditor', 'purchase:create')).toBe(false);
      expect(hasPermission('auditor', 'purchase:post')).toBe(false);
      expect(hasPermission('auditor', 'sales:dispatch')).toBe(false);
      expect(hasPermission('auditor', 'invoice:create')).toBe(false);
      expect(hasPermission('auditor', 'finance:payment')).toBe(false);
    });

    it('restricts purchase_operator to purchase and weighment workflows only', () => {
      expect(hasPermission('purchase_operator', 'purchase:create')).toBe(true);
      expect(hasPermission('purchase_operator', 'weighment:record')).toBe(true);
      expect(hasPermission('purchase_operator', 'purchase:post')).toBe(false);
      expect(hasPermission('purchase_operator', 'sales:dispatch')).toBe(false);
    });
  });

  describe('Server-Side Authorization Enforcement', () => {
    it('allows authorized actions without error', () => {
      expect(() => enforceAuthorization(adminSession, 'invoice:delete', companyA)).not.toThrow();
      expect(() => enforceAuthorization(managerSession, 'purchase:post', companyA)).not.toThrow();
    });

    it('throws AuthorizationError when role lacks required permission', () => {
      expect(() => enforceAuthorization(auditorSession, 'purchase:post', companyA)).toThrow(
        AuthorizationError
      );
      expect(() => enforceAuthorization(managerSession, 'invoice:delete', companyA)).toThrow(
        "Permission denied: Role 'manager' is not authorized to perform 'invoice:delete'."
      );
    });

    it('throws AuthorizationError when session is missing', () => {
      expect(() => enforceAuthorization(null, 'purchase:create')).toThrow(
        'Authentication required. Active session was not found.'
      );
    });
  });

  describe('Company-Level Access Restrictions (Data Isolation)', () => {
    it('allows access when user company matches target entity company', () => {
      expect(() => enforceAuthorization(managerSession, 'purchase:create', companyA)).not.toThrow();
    });

    it('rejects cross-company access attempts for non-superadmin users', () => {
      expect(() => enforceAuthorization(managerSession, 'purchase:create', companyB)).toThrow(
        "Cross-company violation: User does not have access to company ID 'b0000000-0000-0000-0000-000000000002'."
      );
    });

    it('allows owner_admin universal oversight across companies', () => {
      expect(() => enforceAuthorization(adminSession, 'purchase:create', companyB)).not.toThrow();
    });
  });

  describe('Session Expiration & Inactivity Timeout', () => {
    it('detects active valid sessions as unexpired', () => {
      expect(isSessionExpired(adminSession)).toBe(false);
    });

    it('detects expired sessions after TTL limit', () => {
      const expiredSession: UserSession = {
        ...adminSession,
        expiresAt: Date.now() - 1000,
      };
      expect(isSessionExpired(expiredSession)).toBe(true);
    });

    it('detects session expiration due to 30-minute inactivity', () => {
      const inactiveSession: UserSession = {
        ...adminSession,
        lastActiveAt: Date.now() - (SESSION_INACTIVITY_TIMEOUT_MS + 5000),
      };
      expect(isSessionExpired(inactiveSession)).toBe(true);
    });
  });

  describe('Security Audit Trail Integrity', () => {
    it('creates immutable security audit records with timestamp and actor', () => {
      const log = createSecurityAuditLog({
        actorId: 'usr-admin-01',
        actorName: 'Admin',
        action: 'PASSWORD_RESET_DISPATCHED',
        entityType: 'USER_CREDENTIAL',
        entityId: 'usr-002',
      });

      expect(log.id).toBeDefined();
      expect(log.action).toBe('PASSWORD_RESET_DISPATCHED');
      expect(log.actorId).toBe('usr-admin-01');
      expect(log.timestamp).toBeDefined();
    });
  });
});
