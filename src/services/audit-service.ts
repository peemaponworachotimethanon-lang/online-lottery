import { nowIso } from '@/lib/datetime';
import { id } from '@/lib/ids';
import type { RepositoryBundle } from '@/repositories/contracts';
import type { RoleName } from '@/types/domain';

/** Canonical action names. Using constants keeps the audit filter list honest. */
export const AUDIT_ACTIONS = {
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_REGISTER: 'USER_REGISTER',
  USER_CREATE_BET: 'USER_CREATE_BET',
  USER_CREATE_DEPOSIT: 'USER_CREATE_DEPOSIT',
  USER_CREATE_WITHDRAWAL: 'USER_CREATE_WITHDRAWAL',
  USER_UPDATE_PROFILE: 'USER_UPDATE_PROFILE',
  USER_CHANGE_PASSWORD: 'USER_CHANGE_PASSWORD',
  ADMIN_ADJUST_WALLET: 'ADMIN_ADJUST_WALLET',
  ADMIN_APPROVE_DEPOSIT: 'ADMIN_APPROVE_DEPOSIT',
  ADMIN_REJECT_DEPOSIT: 'ADMIN_REJECT_DEPOSIT',
  ADMIN_APPROVE_WITHDRAWAL: 'ADMIN_APPROVE_WITHDRAWAL',
  ADMIN_REJECT_WITHDRAWAL: 'ADMIN_REJECT_WITHDRAWAL',
  ADMIN_CREATE_RESULT: 'ADMIN_CREATE_RESULT',
  ADMIN_SETTLE_ROUND: 'ADMIN_SETTLE_ROUND',
  ADMIN_UPDATE_RATE: 'ADMIN_UPDATE_RATE',
  ADMIN_CREATE_LOTTERY: 'ADMIN_CREATE_LOTTERY',
  ADMIN_UPDATE_LOTTERY: 'ADMIN_UPDATE_LOTTERY',
  ADMIN_CREATE_ROUND: 'ADMIN_CREATE_ROUND',
  ADMIN_UPDATE_ROUND: 'ADMIN_UPDATE_ROUND',
  ADMIN_UPDATE_BET_TYPE: 'ADMIN_UPDATE_BET_TYPE',
  ADMIN_UPDATE_USER_STATUS: 'ADMIN_UPDATE_USER_STATUS',
  ADMIN_UPDATE_USER_ROLES: 'ADMIN_UPDATE_USER_ROLES',
  ADMIN_RESET_PASSWORD: 'ADMIN_RESET_PASSWORD',
  ADMIN_BROADCAST: 'ADMIN_BROADCAST',
  ADMIN_RESET_DEMO_DATA: 'ADMIN_RESET_DEMO_DATA',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditContext {
  actorId: string | null;
  actorRole: RoleName | 'system';
  ip: string;
  userAgent: string;
}

export interface AuditEntry {
  action: AuditAction | string;
  resource: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Audit writing is intentionally fire-and-forget at the call site but awaited
 * here, so a failure to record is visible in logs and never silently swallows a
 * financial action.
 */
export class AuditService {
  constructor(private readonly repos: RepositoryBundle) {}

  async record(context: AuditContext, entry: AuditEntry): Promise<void> {
    await this.repos.audit.record({
      id: id('aud'),
      actorId: context.actorId,
      actorRole: context.actorRole,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: context.ip,
      userAgent: context.userAgent,
      createdAt: nowIso(),
    });
  }
}
