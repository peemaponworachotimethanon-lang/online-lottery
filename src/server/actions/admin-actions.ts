'use server';

import { revalidatePath } from 'next/cache';
import { nowIso } from '@/lib/datetime';
import { conflict, fail, notFound, ok, validation, type ActionResult } from '@/lib/errors';
import { id } from '@/lib/ids';
import { bahtToSatang, rateFromX } from '@/lib/money';
import { hashPassword } from '@/lib/password';
import { invalidateCatalogue, invalidateRates, invalidateResults, invalidateRounds } from '@/providers/cache';
import { getQueue } from '@/providers/queue';
import {
  betTypeFormSchema,
  broadcastNotificationSchema,
  lotteryFormSchema,
  payoutRateFormSchema,
  resultFormSchema,
  reviewSchema,
  roundFormSchema,
  userRolesSchema,
  userStatusSchema,
  walletAdjustmentSchema,
  type BetTypeFormInput,
  type BroadcastNotificationInput,
  type LotteryFormInput,
  type PayoutRateFormInput,
  type ResultFormInput,
  type ReviewInput,
  type RoundFormInput,
  type UserRolesInput,
  type UserStatusInput,
  type WalletAdjustmentInput,
} from '@/schemas/admin';
import { auditContext, enforceRateLimit, requirePermission } from '@/server/context';
import { AUDIT_ACTIONS } from '@/services/audit-service';
import { getServices } from '@/services/container';
import type { SettlementSummary } from '@/types/domain';

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export async function setUserStatusAction(raw: UserStatusInput): Promise<ActionResult<null>> {
  try {
    const actor = await requirePermission('user.edit');
    const input = userStatusSchema.parse(raw);
    await enforceRateLimit('adminSensitive', actor.id);

    const services = getServices();
    const target = await services.repos.users.findById(input.userId);
    if (!target) throw notFound('ไม่พบผู้ใช้งาน');
    if (target.id === actor.id) throw conflict('ไม่สามารถเปลี่ยนสถานะบัญชีของตนเองได้');

    await services.repos.users.update(input.userId, { status: input.status });
    await services.audit.record(await auditContext(actor), {
      action: AUDIT_ACTIONS.ADMIN_UPDATE_USER_STATUS,
      resource: 'user',
      resourceId: input.userId,
      before: { status: target.status },
      after: { status: input.status, reason: input.reason },
    });

    revalidatePath('/admin/users');
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function setUserRolesAction(raw: UserRolesInput): Promise<ActionResult<null>> {
  try {
    const actor = await requirePermission('user.edit');
    const input = userRolesSchema.parse(raw);
    const services = getServices();
    const target = await services.repos.users.findById(input.userId);
    if (!target) throw notFound('ไม่พบผู้ใช้งาน');

    await services.repos.users.update(input.userId, { roles: input.roles });
    await services.audit.record(await auditContext(actor), {
      action: AUDIT_ACTIONS.ADMIN_UPDATE_USER_ROLES,
      resource: 'user',
      resourceId: input.userId,
      before: { roles: target.roles },
      after: { roles: input.roles },
    });
    revalidatePath('/admin/users');
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function resetUserPasswordAction(
  userId: string,
): Promise<ActionResult<{ temporaryPassword: string }>> {
  try {
    const actor = await requirePermission('user.edit');
    await enforceRateLimit('adminSensitive', actor.id);
    const services = getServices();
    const target = await services.repos.users.findById(userId);
    if (!target) throw notFound('ไม่พบผู้ใช้งาน');

    // Demo-only: a real reset emails a single-use, expiring link and never
    // displays a password to an operator.
    const temporaryPassword = `Tmp${Math.floor(Math.random() * 900_000 + 100_000)}!a`;
    await services.repos.users.update(userId, { passwordHash: hashPassword(temporaryPassword) });
    await services.audit.record(await auditContext(actor), {
      action: AUDIT_ACTIONS.ADMIN_RESET_PASSWORD,
      resource: 'user',
      resourceId: userId,
    });
    return ok({ temporaryPassword });
  } catch (error) {
    return fail(error);
  }
}

export async function adjustWalletAction(raw: WalletAdjustmentInput): Promise<ActionResult<null>> {
  try {
    const actor = await requirePermission('wallet.adjust');
    const input = walletAdjustmentSchema.parse(raw);
    await enforceRateLimit('adminSensitive', actor.id);

    const services = getServices();
    await services.idempotency.run(
      { key: input.idempotencyKey, scope: 'wallet-adjust', userId: actor.id, payload: input },
      async () => {
        await services.cashier.adjustWallet(
          { userId: input.userId, amountBaht: input.amountBaht, reason: input.reason },
          await auditContext(actor),
        );
        return { done: true };
      },
    );

    revalidatePath('/admin/users');
    revalidatePath('/admin/wallet');
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

export async function saveLotteryAction(
  raw: LotteryFormInput,
  lotteryId?: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission('lottery.manage');
    const input = lotteryFormSchema.parse(raw);
    const services = getServices();

    if (lotteryId) {
      const before = await services.repos.lotteries.findById(lotteryId);
      if (!before) throw notFound('ไม่พบหวย');
      await services.repos.lotteries.update(lotteryId, input);
      await services.audit.record(await auditContext(actor), {
        action: AUDIT_ACTIONS.ADMIN_UPDATE_LOTTERY,
        resource: 'lottery',
        resourceId: lotteryId,
        before: { name: before.name, status: before.status },
        after: { name: input.name, status: input.status },
      });
      await invalidateCatalogue();
      revalidatePath('/admin/lotteries');
      return ok({ id: lotteryId });
    }

    const existing = await services.repos.lotteries.findBySlug(input.slug);
    if (existing) throw validation('slug นี้ถูกใช้แล้ว', { slug: 'slug นี้ถูกใช้แล้ว' });

    const at = nowIso();
    const created = await services.repos.lotteries.create({
      id: id('lot'),
      ...input,
      sortOrder: 100,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    });
    await services.audit.record(await auditContext(actor), {
      action: AUDIT_ACTIONS.ADMIN_CREATE_LOTTERY,
      resource: 'lottery',
      resourceId: created.id,
      after: { name: created.name },
    });
    await invalidateCatalogue();
    revalidatePath('/admin/lotteries');
    return ok({ id: created.id });
  } catch (error) {
    return fail(error);
  }
}

export async function deleteLotteryAction(lotteryId: string): Promise<ActionResult<null>> {
  try {
    const actor = await requirePermission('lottery.manage');
    const services = getServices();
    await services.repos.lotteries.softDelete(lotteryId);
    await services.audit.record(await auditContext(actor), {
      action: AUDIT_ACTIONS.ADMIN_UPDATE_LOTTERY,
      resource: 'lottery',
      resourceId: lotteryId,
      after: { deleted: true },
    });
    await invalidateCatalogue();
    revalidatePath('/admin/lotteries');
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function saveRoundAction(
  raw: RoundFormInput,
  roundId?: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission('lottery.manage');
    const input = roundFormSchema.parse(raw);
    const services = getServices();

    const patch = {
      lotteryId: input.lotteryId,
      roundCode: input.roundCode,
      openAt: new Date(input.openAt).toISOString(),
      closeAt: new Date(input.closeAt).toISOString(),
      resultAt: new Date(input.resultAt).toISOString(),
      status: input.status,
    };

    if (roundId) {
      await services.repos.rounds.update(roundId, patch);
      await services.audit.record(await auditContext(actor), {
        action: AUDIT_ACTIONS.ADMIN_UPDATE_ROUND,
        resource: 'round',
        resourceId: roundId,
        after: patch,
      });
      await invalidateRounds();
      revalidatePath('/admin/rounds');
      return ok({ id: roundId });
    }

    const at = nowIso();
    const created = await services.repos.rounds.create({
      id: id('rnd'),
      ...patch,
      settledAt: null,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    });
    await services.audit.record(await auditContext(actor), {
      action: AUDIT_ACTIONS.ADMIN_CREATE_ROUND,
      resource: 'round',
      resourceId: created.id,
      after: patch,
    });
    await invalidateRounds();
    revalidatePath('/admin/rounds');
    return ok({ id: created.id });
  } catch (error) {
    return fail(error);
  }
}

export async function saveBetTypeAction(
  raw: BetTypeFormInput,
  betTypeId?: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission('lottery.manage');
    const input = betTypeFormSchema.parse(raw);
    const services = getServices();

    const patch = {
      name: input.name,
      nameTh: input.nameTh,
      code: input.code,
      digitLength: input.digitLength,
      matchStrategy: input.matchStrategy,
      minBet: bahtToSatang(input.minBetBaht),
      maxBet: bahtToSatang(input.maxBetBaht),
      maxPerNumber: bahtToSatang(input.maxPerNumberBaht),
      isActive: input.isActive,
      description: input.description,
    };

    if (betTypeId) {
      await services.repos.betTypes.update(betTypeId, patch);
      await services.audit.record(await auditContext(actor), {
        action: AUDIT_ACTIONS.ADMIN_UPDATE_BET_TYPE,
        resource: 'bet-type',
        resourceId: betTypeId,
        after: patch,
      });
      await invalidateCatalogue();
      revalidatePath('/admin/bet-types');
      return ok({ id: betTypeId });
    }

    const existing = await services.repos.betTypes.findByCode(input.code);
    if (existing) throw validation('รหัสนี้ถูกใช้แล้ว', { code: 'รหัสนี้ถูกใช้แล้ว' });

    const at = nowIso();
    const created = await services.repos.betTypes.create({
      id: id('btp'),
      ...patch,
      sortOrder: 100,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    });
    await invalidateCatalogue();
    revalidatePath('/admin/bet-types');
    return ok({ id: created.id });
  } catch (error) {
    return fail(error);
  }
}

export async function savePayoutRateAction(
  raw: PayoutRateFormInput,
  rateId?: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission('lottery.manage');
    const input = payoutRateFormSchema.parse(raw);
    const services = getServices();
    const rateMilli = rateFromX(input.rateX);

    if (rateId) {
      const before = await services.repos.payoutRates.list();
      const previous = before.find((rate) => rate.id === rateId);
      await services.repos.payoutRates.update(rateId, { rateMilli, isActive: input.isActive });
      await services.audit.record(await auditContext(actor), {
        action: AUDIT_ACTIONS.ADMIN_UPDATE_RATE,
        resource: 'payout-rate',
        resourceId: rateId,
        before: previous ? { rateMilli: previous.rateMilli, isActive: previous.isActive } : null,
        after: { rateMilli, isActive: input.isActive },
      });
      await invalidateRates(input.lotteryId ?? undefined);
      revalidatePath('/admin/payout-rates');
      return ok({ id: rateId });
    }

    const at = nowIso();
    const created = await services.repos.payoutRates.upsert({
      id: id('rat'),
      betTypeCode: input.betTypeCode,
      lotteryId: input.lotteryId,
      rateMilli,
      effectiveFrom: at,
      effectiveTo: null,
      isActive: input.isActive,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    });
    await services.audit.record(await auditContext(actor), {
      action: AUDIT_ACTIONS.ADMIN_UPDATE_RATE,
      resource: 'payout-rate',
      resourceId: created.id,
      after: { rateMilli, betTypeCode: input.betTypeCode },
    });
    await invalidateRates(input.lotteryId ?? undefined);
    revalidatePath('/admin/payout-rates');
    return ok({ id: created.id });
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ */
/* Results and settlement                                              */
/* ------------------------------------------------------------------ */

export async function createResultAction(raw: ResultFormInput): Promise<ActionResult<{ resultId: string }>> {
  try {
    const actor = await requirePermission('result.manage');
    const input = resultFormSchema.parse(raw);
    const services = getServices();

    const round = await services.repos.rounds.findById(input.roundId);
    if (!round) throw notFound('ไม่พบงวดหวย');

    const existing = await services.repos.results.findByRoundId(input.roundId);
    if (existing) throw conflict('งวดนี้มีผลรางวัลแล้ว');

    const at = nowIso();
    const result = await services.repos.results.create({
      id: id('res'),
      lotteryId: round.lotteryId,
      roundId: round.id,
      top3: input.top3,
      // Convention: the 2-digit top prize is the last two digits of the 3-digit top.
      top2: input.top3.slice(1),
      bottom2: input.bottom2,
      announcedAt: at,
      enteredByUserId: actor.id,
      isFinal: true,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    });

    await services.repos.rounds.update(round.id, { status: 'resulted' });
    await services.audit.record(await auditContext(actor), {
      action: AUDIT_ACTIONS.ADMIN_CREATE_RESULT,
      resource: 'result',
      resourceId: result.id,
      after: { roundId: round.id, top3: result.top3, bottom2: result.bottom2 },
    });

    await invalidateResults();
    revalidatePath('/results');
    revalidatePath('/admin/results');
    return ok({ resultId: result.id });
  } catch (error) {
    return fail(error);
  }
}

export async function previewSettlementAction(
  roundId: string,
): Promise<ActionResult<{ evaluated: number; winners: number; payout: number }>> {
  try {
    await requirePermission('result.manage');
    const services = getServices();
    const result = await services.repos.results.findByRoundId(roundId);
    if (!result) throw conflict('ยังไม่มีผลรางวัลสำหรับงวดนี้');
    return ok(await services.settlement.previewRound(roundId, result));
  } catch (error) {
    return fail(error);
  }
}

/**
 * Runs settlement.
 *
 * `mode: 'queue'` is the production-shaped path: the HTTP request only enqueues
 * the job and returns immediately, so a round with a very large number of bets is
 * never processed inside a request. `mode: 'inline'` exists so the demo can show
 * the result without a worker process.
 */
export async function settleRoundAction(
  roundId: string,
  mode: 'inline' | 'queue' = 'inline',
): Promise<ActionResult<SettlementSummary | { queued: true; jobId: string }>> {
  try {
    const actor = await requirePermission('result.manage');
    await enforceRateLimit('adminSensitive', actor.id);
    const services = getServices();

    if (mode === 'queue') {
      const job = await getQueue().enqueue(
        'settle-round',
        { roundId, actorId: actor.id },
        { jobId: `settle-round:${roundId}` },
      );
      return ok({ queued: true as const, jobId: job.id });
    }

    const summary = await services.settlement.settleLotteryRound(roundId, await auditContext(actor));
    revalidatePath('/admin/results');
    revalidatePath('/admin/bets');
    return ok(summary);
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ */
/* Cashier review                                                      */
/* ------------------------------------------------------------------ */

export async function reviewDepositAction(raw: ReviewInput): Promise<ActionResult<null>> {
  try {
    const actor = await requirePermission('deposit.approve');
    const input = reviewSchema.parse(raw);
    await enforceRateLimit('adminSensitive', actor.id);

    const services = getServices();
    await services.idempotency.run(
      { key: input.idempotencyKey, scope: 'review-deposit', userId: actor.id, payload: input },
      async () => {
        await services.cashier.reviewDeposit(
          input.id,
          input.decision,
          input.note,
          await auditContext(actor),
        );
        return { done: true };
      },
    );

    revalidatePath('/admin/deposits');
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function reviewWithdrawalAction(raw: ReviewInput): Promise<ActionResult<null>> {
  try {
    const actor = await requirePermission('withdrawal.approve');
    const input = reviewSchema.parse(raw);
    await enforceRateLimit('adminSensitive', actor.id);

    const services = getServices();
    await services.idempotency.run(
      { key: input.idempotencyKey, scope: 'review-withdrawal', userId: actor.id, payload: input },
      async () => {
        await services.cashier.reviewWithdrawal(
          input.id,
          input.decision,
          input.note,
          await auditContext(actor),
        );
        return { done: true };
      },
    );

    revalidatePath('/admin/withdrawals');
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ */
/* Notifications and demo data                                         */
/* ------------------------------------------------------------------ */

export async function broadcastNotificationAction(
  raw: BroadcastNotificationInput,
): Promise<ActionResult<{ queued: number }>> {
  try {
    const actor = await requirePermission('settings.manage');
    const input = broadcastNotificationSchema.parse(raw);
    const services = getServices();

    const page = await services.repos.users.findMany({ page: 1, pageSize: 100, status: 'active' });
    const userIds = page.items.map((user) => user.id);

    // Fan-out goes through the queue, never inline in the request.
    await getQueue().enqueue('broadcast-notification', {
      userIds,
      title: input.title,
      body: input.body,
      type: input.type,
    });

    await services.audit.record(await auditContext(actor), {
      action: AUDIT_ACTIONS.ADMIN_BROADCAST,
      resource: 'notification',
      after: { title: input.title, recipients: userIds.length },
    });

    return ok({ queued: userIds.length });
  } catch (error) {
    return fail(error);
  }
}

export async function verifyLedgerAction(): Promise<
  ActionResult<{ consistent: boolean; balance: number; ledgerSum: number }>
> {
  try {
    await requirePermission('report.view');
    return ok(await getServices().wallet.verifyLedger());
  } catch (error) {
    return fail(error);
  }
}
