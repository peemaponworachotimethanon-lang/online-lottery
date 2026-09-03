'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/errors';
import {
  changePasswordSchema,
  updateProfileSchema,
  updateSettingsSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
  type UpdateSettingsInput,
} from '@/schemas/auth';
import { auditContext, requireUser } from '@/server/context';
import { getServices } from '@/services/container';
import { AUDIT_ACTIONS } from '@/services/audit-service';
import { toPublicUser } from '@/services/auth-service';
import type { PublicUser } from '@/types/domain';

export async function updateProfileAction(raw: UpdateProfileInput): Promise<ActionResult<PublicUser>> {
  try {
    const user = await requireUser();
    const input = updateProfileSchema.parse(raw);
    const services = getServices();

    const updated = await services.repos.users.update(user.id, {
      displayName: input.displayName,
      phone: input.phone,
      bankName: input.bankName || null,
      bankAccountName: input.bankAccountName || null,
      bankAccountNumber: input.bankAccountNumber || null,
    });

    await services.audit.record(await auditContext(user), {
      action: AUDIT_ACTIONS.USER_UPDATE_PROFILE,
      resource: 'user',
      resourceId: user.id,
      before: { displayName: user.displayName, phone: user.phone },
      after: { displayName: input.displayName, phone: input.phone },
    });

    revalidatePath('/account');
    return ok(toPublicUser(updated));
  } catch (error) {
    return fail(error);
  }
}

export async function updateSettingsAction(raw: UpdateSettingsInput): Promise<ActionResult<PublicUser>> {
  try {
    const user = await requireUser();
    const input = updateSettingsSchema.parse(raw);
    const services = getServices();
    const updated = await services.repos.users.update(user.id, {
      marketingOptIn: input.marketingOptIn,
      twoFactorEnabled: input.twoFactorEnabled,
    });
    revalidatePath('/account/settings');
    return ok(toPublicUser(updated));
  } catch (error) {
    return fail(error);
  }
}

export async function changePasswordAction(raw: ChangePasswordInput): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    const input = changePasswordSchema.parse(raw);
    const services = getServices();
    await services.auth.changePassword(user.id, input, await auditContext(user));
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function toggleFavoriteLotteryAction(
  lotteryId: string,
): Promise<ActionResult<{ favorites: string[] }>> {
  try {
    const user = await requireUser();
    const services = getServices();
    const next = user.favoriteLotteryIds.includes(lotteryId)
      ? user.favoriteLotteryIds.filter((candidate) => candidate !== lotteryId)
      : [...user.favoriteLotteryIds, lotteryId];
    await services.repos.users.update(user.id, { favoriteLotteryIds: next });
    revalidatePath('/dashboard');
    return ok({ favorites: next });
  } catch (error) {
    return fail(error);
  }
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    await getServices().notifications.markRead(notificationId, user.id);
    revalidatePath('/account/notifications');
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<{ updated: number }>> {
  try {
    const user = await requireUser();
    const updated = await getServices().notifications.markAllRead(user.id);
    revalidatePath('/account/notifications');
    return ok({ updated });
  } catch (error) {
    return fail(error);
  }
}
