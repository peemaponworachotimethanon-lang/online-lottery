import { nowIso } from '@/lib/datetime';
import { conflict, notFound } from '@/lib/errors';
import { isWinningNumber } from '@/lib/lottery-rules';
import { formatMoney, type Satang } from '@/lib/money';
import type { RepositoryBundle } from '@/repositories/contracts';
import type { Bet, BetType, LotteryResult, SettlementSummary } from '@/types/domain';
import type { AuditService } from './audit-service';
import { AUDIT_ACTIONS, type AuditContext } from './audit-service';
import type { NotificationService } from './notification-service';
import type { WalletService } from './wallet-service';

/**
 * SettlementService.
 *
 * IDEMPOTENCY — three independent guards, because paying a prize twice is the
 * worst failure this system can have:
 *   G1. `settlementLocks.tryLock(roundId)` — only one settlement run per round
 *       can start. In PostgreSQL this becomes
 *       `UPDATE lottery_rounds SET status='settled' WHERE id=$1 AND status<>'settled'`
 *       and the run proceeds only if one row was affected.
 *   G2. Only bets in status `confirmed` are selected. Settlement moves them to
 *       `won`/`lost`, so a second pass finds nothing to pay.
 *   G3. The win credit carries `referenceType='bet'`/`referenceId=betId`; a
 *       reconciliation job can assert at most one `win` row per bet.
 *
 * BATCHING — bets are processed in pages. A round with 100k bets is settled by
 * enqueuing follow-up batches on the job queue, never in one HTTP request.
 */

export const SETTLEMENT_BATCH_SIZE = 200;

export class SettlementService {
  constructor(
    private readonly repos: RepositoryBundle,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  async settleLotteryRound(
    roundId: string,
    context: AuditContext,
    options: { batchSize?: number } = {},
  ): Promise<SettlementSummary> {
    const startedAt = Date.now();
    const batchSize = options.batchSize ?? SETTLEMENT_BATCH_SIZE;

    const round = await this.repos.rounds.findById(roundId);
    if (!round) throw notFound('ไม่พบงวดหวย');

    const result = await this.repos.results.findByRoundId(roundId);
    if (!result) throw conflict('ยังไม่มีผลรางวัลสำหรับงวดนี้');

    // G1 — single-run lock.
    const acquired = await this.repos.settlementLocks.tryLock(roundId);
    if (!acquired) {
      return {
        roundId,
        betsEvaluated: 0,
        betsWon: 0,
        betsLost: 0,
        totalPayout: 0,
        alreadySettled: true,
        durationMs: Date.now() - startedAt,
      };
    }

    const betTypes = await this.repos.betTypes.list({ includeInactive: true });
    const betTypeByCode = new Map<string, BetType>(betTypes.map((betType) => [betType.code, betType]));

    let evaluated = 0;
    let won = 0;
    let lost = 0;
    let totalPayout: Satang = 0;

    // G2 — `findConfirmedForRound` only ever returns unsettled bets, and each
    // batch reads from offset 0 because settled bets leave the result set.
    for (;;) {
      const batch = await this.repos.bets.findConfirmedForRound(roundId, 0, batchSize);
      if (batch.length === 0) break;

      for (const bet of batch) {
        const outcome = await this.settleBet(bet, result, betTypeByCode);
        evaluated += 1;
        totalPayout += outcome.payout;
        if (outcome.payout > 0) won += 1;
        else lost += 1;
      }

      if (batch.length < batchSize) break;
    }

    await this.repos.rounds.update(roundId, { status: 'settled', settledAt: nowIso() });
    await this.audit.record(context, {
      action: AUDIT_ACTIONS.ADMIN_SETTLE_ROUND,
      resource: 'round',
      resourceId: roundId,
      after: { evaluated, won, lost, totalPayout },
    });

    return {
      roundId,
      betsEvaluated: evaluated,
      betsWon: won,
      betsLost: lost,
      totalPayout,
      alreadySettled: false,
      durationMs: Date.now() - startedAt,
    };
  }

  /** Evaluates one bet and, when it wins, credits the wallet exactly once. */
  private async settleBet(
    bet: Bet,
    result: LotteryResult,
    betTypeByCode: Map<string, BetType>,
  ): Promise<{ payout: Satang }> {
    let payout: Satang = 0;
    const items = bet.items.map((item) => {
      const betType = betTypeByCode.get(item.betTypeCode);
      if (!betType) return { ...item, status: 'void' as const, payout: 0 };
      const isWin = isWinningNumber(betType.matchStrategy, item.number, result);
      const itemPayout = isWin ? item.potentialPayout : 0;
      payout += itemPayout;
      return { ...item, status: isWin ? ('won' as const) : ('lost' as const), payout: itemPayout };
    });

    const settledAt = nowIso();

    // Flip status BEFORE crediting: if the credit throws, the bet is not left in
    // `confirmed` where a rerun would pay it a second time. The missing credit is
    // then recoverable from the audit log, which is the safe direction to fail.
    await this.repos.bets.update(bet.id, {
      items,
      status: payout > 0 ? 'won' : 'lost',
      totalPayout: payout,
      settledAt,
    });

    if (payout > 0) {
      const lottery = await this.repos.lotteries.findById(bet.lotteryId);
      await this.wallet.credit({
        userId: bet.userId,
        type: 'win',
        amount: payout,
        description: `รางวัล ${lottery?.nameTh ?? ''} • บิล ${bet.reference}`,
        referenceId: bet.id,
        referenceType: 'bet',
      });
      await this.notifications.push({
        userId: bet.userId,
        type: 'result',
        title: 'ยินดีด้วย คุณถูกรางวัล',
        body: `บิล ${bet.reference} ได้รับรางวัล ${formatMoney(payout)}`,
        href: '/account/bets',
      });
    }

    return { payout };
  }

  /**
   * Preview used by the admin console before confirming a result: reports what a
   * settlement *would* pay, without moving any money.
   */
  async previewRound(roundId: string, result: Pick<LotteryResult, 'top3' | 'top2' | 'bottom2'>) {
    const betTypes = await this.repos.betTypes.list({ includeInactive: true });
    const betTypeByCode = new Map(betTypes.map((betType) => [betType.code, betType]));

    let evaluated = 0;
    let winners = 0;
    let payout = 0;
    let cursor = 0;

    for (;;) {
      const batch = await this.repos.bets.findConfirmedForRound(roundId, cursor, SETTLEMENT_BATCH_SIZE);
      if (batch.length === 0) break;
      for (const bet of batch) {
        evaluated += 1;
        let betPayout = 0;
        for (const item of bet.items) {
          const betType = betTypeByCode.get(item.betTypeCode);
          if (!betType) continue;
          if (isWinningNumber(betType.matchStrategy, item.number, result)) {
            betPayout += item.potentialPayout;
          }
        }
        if (betPayout > 0) winners += 1;
        payout += betPayout;
      }
      cursor += batch.length;
      if (batch.length < SETTLEMENT_BATCH_SIZE) break;
    }

    return { evaluated, winners, payout };
  }
}
