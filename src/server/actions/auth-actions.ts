'use server';

import { redirect } from 'next/navigation';
import { fail, ok, type ActionResult } from '@/lib/errors';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
} from '@/schemas/auth';
import { getServices } from '@/services/container';
import { auditContext, enforceRateLimit, getRequestMeta } from '@/server/context';
import { clearSessionCookie, setSessionCookie } from '@/server/session';
import type { PublicUser } from '@/types/domain';

/**
 * Every action re-validates its input with the same Zod schema the client form
 * uses. The client validation is a UX affordance; this is the enforcement.
 */

export async function loginAction(raw: LoginInput): Promise<ActionResult<PublicUser>> {
  try {
    const input = loginSchema.parse(raw);
    await enforceRateLimit('login', input.email);

    const services = getServices();
    const meta = await getRequestMeta();
    const user = await services.auth.login(input, {
      actorId: null,
      actorRole: 'system',
      ...meta,
    });

    await setSessionCookie({ sub: user.id, roles: user.roles, username: user.username });
    return ok(user);
  } catch (error) {
    return fail(error);
  }
}

export async function registerAction(raw: RegisterInput): Promise<ActionResult<PublicUser>> {
  try {
    const input = registerSchema.parse(raw);
    await enforceRateLimit('register');

    const services = getServices();
    const meta = await getRequestMeta();
    const user = await services.auth.register(input, {
      actorId: null,
      actorRole: 'system',
      ...meta,
    });

    await setSessionCookie({ sub: user.id, roles: user.roles, username: user.username });
    return ok(user);
  } catch (error) {
    return fail(error);
  }
}

export async function forgotPasswordAction(
  raw: ForgotPasswordInput,
): Promise<ActionResult<{ delivered: boolean }>> {
  try {
    const input = forgotPasswordSchema.parse(raw);
    await enforceRateLimit('forgotPassword', input.email);
    const services = getServices();
    return ok(await services.auth.requestPasswordReset(input.email));
  } catch (error) {
    return fail(error);
  }
}

export async function logoutAction(): Promise<void> {
  await auditContext();
  await clearSessionCookie();
  redirect('/');
}
