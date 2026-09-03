import type { PermissionName, RoleName } from '@/types/domain';

/**
 * Single source of truth for authorization.
 *
 * Roles are additive: a user's effective permission set is the union of the sets
 * granted by each of their roles. Every server entry point that mutates data must
 * call `assertPermission` — never rely on the UI hiding a control.
 */
export const ROLE_PERMISSIONS: Record<RoleName, readonly PermissionName[]> = {
  user: [],
  support: ['user.view', 'wallet.view', 'bet.view', 'report.view'],
  finance: [
    'user.view',
    'wallet.view',
    'wallet.adjust',
    'deposit.approve',
    'withdrawal.approve',
    'bet.view',
    'report.view',
    'audit.view',
  ],
  admin: [
    'user.view',
    'user.edit',
    'wallet.view',
    'wallet.adjust',
    'deposit.approve',
    'withdrawal.approve',
    'lottery.manage',
    'result.manage',
    'report.view',
    'audit.view',
    'bet.view',
  ],
  superadmin: [
    'user.view',
    'user.edit',
    'wallet.view',
    'wallet.adjust',
    'deposit.approve',
    'withdrawal.approve',
    'lottery.manage',
    'result.manage',
    'report.view',
    'settings.manage',
    'audit.view',
    'bet.view',
  ],
};

export const ROLE_LABELS: Record<RoleName, string> = {
  user: 'ผู้ใช้งาน',
  support: 'ฝ่ายบริการ',
  finance: 'ฝ่ายการเงิน',
  admin: 'ผู้ดูแลระบบ',
  superadmin: 'ผู้ดูแลระบบสูงสุด',
};

export interface Principal {
  id: string;
  roles: readonly RoleName[];
}

export function permissionsFor(roles: readonly RoleName[]): Set<PermissionName> {
  const set = new Set<PermissionName>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) set.add(permission);
  }
  return set;
}

export function can(principal: Principal | null, permission: PermissionName): boolean {
  if (!principal) return false;
  return permissionsFor(principal.roles).has(permission);
}

export function canAny(
  principal: Principal | null,
  permissions: readonly PermissionName[],
): boolean {
  return permissions.some((permission) => can(principal, permission));
}

export function canAll(
  principal: Principal | null,
  permissions: readonly PermissionName[],
): boolean {
  return permissions.every((permission) => can(principal, permission));
}

/** True when the principal may open any part of the admin console. */
export function isStaff(principal: Principal | null): boolean {
  if (!principal) return false;
  return principal.roles.some((role) => role !== 'user');
}
