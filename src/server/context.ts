import { headers } from 'next/headers';
import { cache } from 'react';
import { forbidden, unauthenticated } from '@/lib/errors';
import { can, isStaff, type Principal } from '@/lib/permissions';
import { getRateLimiter, RATE_LIMITS, type RateLimitName } from '@/providers/rate-limit';
import { rateLimited } from '@/lib/errors';
import { getServices } from '@/services/container';
import type { AuditContext } from '@/services/audit-service';
import type { PermissionName, PublicUser } from '@/types/domain';
import { toPublicUser } from '@/services/auth-service';
import { readSession } from './session';

/**
 * Request-scoped context helpers.
 *
 * `getCurrentUser` is wrapped in React's `cache` so several server components in
 * one render share a single lookup instead of re-reading per component.
 *
 * AUTHORIZATION RULE: roles come from the stored user record, not from the JWT.
 * A token issued before a demotion cannot retain the old permissions.
 */
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const services = getServices();
  const user = await services.repos.users.findById(session.sub);
  if (!user || user.status === 'suspended' || user.status === 'closed') return null;
  return toPublicUser(user);
});

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  return user;
}

export async function requirePermission(permission: PermissionName): Promise<PublicUser> {
  const user = await requireUser();
  const principal: Principal = { id: user.id, roles: user.roles };
  if (!can(principal, permission)) throw forbidden();
  return user;
}

export async function requireStaff(): Promise<PublicUser> {
  const user = await requireUser();
  if (!isStaff({ id: user.id, roles: user.roles })) throw forbidden();
  return user;
}

export async function getRequestMeta(): Promise<{ ip: string; userAgent: string }> {
  const store = await headers();
  const forwarded = store.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || store.get('x-real-ip') || '0.0.0.0';
  return { ip, userAgent: store.get('user-agent') ?? 'unknown' };
}

export async function auditContext(user?: PublicUser | null): Promise<AuditContext> {
  const meta = await getRequestMeta();
  const actor = user === undefined ? await getCurrentUser() : user;
  return {
    actorId: actor?.id ?? null,
    actorRole: actor?.roles[0] ?? 'system',
    ip: meta.ip,
    userAgent: meta.userAgent,
  };
}

/**
 * Applies a named rate limit, keyed by user id when available and by IP
 * otherwise. Throws `RATE_LIMITED` so every caller reports it consistently.
 */
export async function enforceRateLimit(name: RateLimitName, identifier?: string): Promise<void> {
  const key = identifier ?? (await getRequestMeta()).ip;
  const result = await getRateLimiter().consume(`${name}:${key}`, RATE_LIMITS[name]);
  if (!result.allowed) {
    throw rateLimited(`ดำเนินการถี่เกินไป กรุณาลองใหม่ใน ${result.retryAfterSeconds} วินาที`);
  }
}
