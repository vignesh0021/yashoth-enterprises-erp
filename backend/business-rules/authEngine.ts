// Yasoth Enterprises Scrap ERP — Security, RBAC & Authorization Engine
// Implements server-side authorization enforcement, secure session token handling, and audit logging

import type { UserRole, UserSession, AuditLog } from '../../src/types/index.ts';

export type PermissionAction =
  | 'company:view'
  | 'company:edit'
  | 'purchase:create'
  | 'purchase:post'
  | 'purchase:delete'
  | 'sales:create'
  | 'sales:dispatch'
  | 'sales:delete'
  | 'weighment:record'
  | 'weighment:delete'
  | 'finance:contra'
  | 'finance:payment'
  | 'finance:expense'
  | 'finance:delete'
  | 'invoice:create'
  | 'invoice:edit'
  | 'invoice:delete'
  | 'inventory:adjust'
  | 'inventory:reverse'
  | 'employees:manage'
  | 'reports:view'
  | 'settings:backup'
  | 'settings:restore'
  | 'settings:migrate'
  | 'admin:full';

export class AuthorizationError extends Error {
  public code: string;
  constructor(message: string, code: string = 'FORBIDDEN') {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
  }
}

// Canonical RBAC Matrix
export const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  owner_admin: [
    'company:view', 'company:edit',
    'purchase:create', 'purchase:post', 'purchase:delete',
    'sales:create', 'sales:dispatch', 'sales:delete',
    'weighment:record', 'weighment:delete',
    'finance:contra', 'finance:payment', 'finance:expense', 'finance:delete',
    'invoice:create', 'invoice:edit', 'invoice:delete',
    'inventory:adjust', 'inventory:reverse',
    'employees:manage',
    'reports:view',
    'settings:backup', 'settings:restore', 'settings:migrate',
    'admin:full'
  ],
  manager: [
    'company:view',
    'purchase:create', 'purchase:post',
    'sales:create', 'sales:dispatch',
    'weighment:record',
    'finance:contra', 'finance:payment', 'finance:expense',
    'invoice:create', 'invoice:edit',
    'inventory:adjust',
    'employees:manage',
    'reports:view',
    'settings:backup'
  ],
  purchase_operator: [
    'company:view',
    'purchase:create',
    'weighment:record',
    'reports:view'
  ],
  weighment_operator: [
    'company:view',
    'weighment:record'
  ],
  weighbridge_operator: [
    'company:view',
    'weighment:record'
  ],
  sales_operator: [
    'company:view',
    'sales:create',
    'invoice:create',
    'reports:view'
  ],
  accounts_operator: [
    'company:view',
    'finance:payment',
    'finance:expense',
    'invoice:create',
    'invoice:edit',
    'reports:view'
  ],
  store_operator: [
    'company:view',
    'inventory:adjust',
    'reports:view'
  ],
  hr_operator: [
    'company:view',
    'employees:manage',
    'reports:view'
  ],
  auditor: [
    'company:view',
    'reports:view'
  ]
};

/**
 * Checks whether a given role has permission to execute an action.
 */
export function hasPermission(role: UserRole, action: PermissionAction): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(action) || permissions.includes('admin:full');
}

/**
 * Enforces authorization for an action. Throws AuthorizationError if forbidden.
 * Also verifies company-level access restrictions.
 */
export function enforceAuthorization(
  session: UserSession | null,
  action: PermissionAction,
  targetCompanyId?: string
): void {
  if (!session) {
    throw new AuthorizationError('Authentication required. Active session was not found.', 'UNAUTHENTICATED');
  }

  // Session expiry check
  if (isSessionExpired(session)) {
    throw new AuthorizationError('Session expired. Please sign in again.', 'SESSION_EXPIRED');
  }

  // Check RBAC permission
  if (!hasPermission(session.role, action)) {
    throw new AuthorizationError(
      `Permission denied: Role '${session.role}' is not authorized to perform '${action}'.`,
      'FORBIDDEN'
    );
  }

  // Company-level isolation check
  if (targetCompanyId && session.companyId && session.role !== 'owner_admin') {
    if (session.companyId !== targetCompanyId) {
      throw new AuthorizationError(
        `Cross-company violation: User does not have access to company ID '${targetCompanyId}'.`,
        'COMPANY_ACCESS_DENIED'
      );
    }
  }
}

export const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Checks whether the session has expired due to timeout.
 */
export function isSessionExpired(session: UserSession): boolean {
  if (!session.expiresAt) return false;
  const now = Date.now();
  if (now > session.expiresAt) return true;
  if (session.lastActiveAt && (now - session.lastActiveAt > SESSION_INACTIVITY_TIMEOUT_MS)) {
    return true;
  }
  return false;
}

/**
 * Computes a secure SHA-256 hash with salt for credential verification.
 */
export async function hashPassword(password: string, salt: string = 'YE_ERP_SALT_2026'): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates an immutable security audit log entry.
 */
export function createSecurityAuditLog(params: {
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  oldState?: string;
  newState?: string;
}): AuditLog {
  return {
    id: 'sec-log-' + Math.random().toString(36).substring(2, 11),
    actorId: params.actorId,
    actorName: params.actorName,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    oldState: params.oldState,
    newState: params.newState,
    timestamp: new Date().toISOString(),
  };
}
