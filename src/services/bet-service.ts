import { nowIso } from '@/lib/datetime';
import { conflict, limitExceeded, notFound, roundClosed, validation } from '@/lib/errors';
import { id, reference } from '@/lib/ids';
import { isRoundAcceptingBets, isValidNumberForType } from '@/lib/lottery-rules';
import { applyRate, bahtToSatang, formatMoney, type Satang } from '@/lib/money';
import type { RepositoryBundle } from '@/repositories/contracts';
import type { PlaceBetInput } from '@/schemas/betting';
import type { Bet, BetItem, BetType, PayoutRate } from '@/types/domain';
import type { AuditService } from './audit-service';
import { AUDIT_ACTIONS, type AuditContext } from './audit-service';
import type { IdempotencyService } from './idempotency-service';
import type { NotificationService } from './notification-service';
import type { WalletService } from './wallet-service';

/**
 * BetService — quoting and placement.
 *
 * Placement is a single logical transaction:
 *   validate -> resolve rates -> debit wallet -> persist immutable bet.
 * If the debit fails, nothing is persisted. If persistence fails after the debit,
 * the stake is refunded through the ledger (compensating entry) rather than left
 * stranded — the demo provider has no cross-aggregate transaction, and production
 * will wrap both in one database transaction instead.
 */

export interface QuotedItem {
  betTypeCode: string;
  betTypeName: string;
  number: string;
  stake: Satang;
  rateMilli: number;
  potentialPayout: Satang;
}

export interface BetQuote {
  roundId: string;
  lotteryId: string;
  items: QuotedItem[];
  totalStake: Satang;
  totalPotentialPayout: Satang;
}

export class BetService {
  constructor(
    private readonly repos: RepositoryBundle,
    private readonly wallet: WalletService,
    private readonly idempotency: IdempotencyService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Validates and prices a slip without touching money.
   * The client uses the same numbers for its preview, but the server recomputes
   * everything — a client-supplied rate or payout is never trusted.
   */
  async quote(userId: string, input: PlaceBetInput, nowMs?: number): Promise<BetQuote> {
    const at0 = nowMs ?? Date.now();
    const round = await this.repos.rounds.findById(input.roundId);
    if (!round) throw notFound('ไม่พบงวดหวย');
    if (!isRoundAcceptingBets(round, at0)) throw roundClosed();

    const lottery = await this.repos.lotteries.findById(round.lotteryId);
    if (!lottery || lottery.status !== 'active') throw notFound('ไม่พบหวยนี้ในระบบ');

    const codes = [...new Set(input.items.map((item) => item.betTypeCode))];
    const betTypes = await this.repos.betTypes.findByCodes(codes);
    const betTypeByCode = new Map<string, BetType>(betTypes.map((betType) => [betType.code, betType]));

    // One batched rate lookup for the whole slip — never one query per row.
    const at = new Date(at0).toISOString();
    const rateByCode: Map<string, PayoutRate> = await this.repos.payoutRates.resolveMany(
      codes,
      lottery.id,
      at,
    );

    const quoted: QuotedItem[] = [];
    let totalStake = 0;
    let totalPotentialPayout = 0;

    // Aggregate per (betType, number) so per-number limits consider the whole slip.
    const slipTotals = new Map<string, number>();

    for (const item of input.items) {
      const betType = betTypeByCode.get(item.betTypeCode);
      if (!betType || !betType.isActive) throw validation(`ไม่พบประเภทการแทง: ${item.betTypeCode}`);
      if (!lottery.betTypeCodes.includes(betType.code)) {
        throw validation(`หวยนี้ไม่รองรับ ${betType.nameTh}`);
      }
      if (!isValidNumberForType(betType, item.number)) {
        throw validation(`${betType.nameTh} ต้องเป็นตัวเลข ${betType.digitLength} หลัก`);
      }

      const stake = bahtToSatang(item.stakeBaht);
      if (stake < betType.minBet) {
        throw validation(`${betType.nameTh} ขั้นต่ำ ${formatMoney(betType.minBet)}`);
      }
      if (stake > betType.maxBet) {
        throw limitExceeded(`${betType.nameTh} สูงสุด ${formatMoney(betType.maxBet)} ต่อรายการ`);
      }

      const rate = rateByCode.get(betType.code);
      if (!rate) throw conflict(`ยังไม่ได้ตั้งค่าอัตราจ่ายสำหรับ ${betType.nameTh}`);

      const slipKey = `${betType.code}:${item.number}`;
      slipTotals.set(slipKey, (slipTotals.get(slipKey) ?? 0) + stake);

      const potentialPayout = applyRate(stake, rate.rateMilli);
      quoted.push({
        betTypeCode: betType.code,
        betTypeName: betType.nameTh,
        number: item.number,
        stake,
        rateMilli: rate.rateMilli,
        potentialPayout,
      });
      totalStake += stake;
      totalPotentialPayout += potentialPayout;
    }

    // Per-number exposure limit, counting bets already placed in this round.
    for (const [slipKey, slipStake] of slipTotals) {
      const [code = '', number = ''] = slipKey.split(':');
      const betType = betTypeByCode.get(code);
      if (!betType) continue;
      const existing = await this.repos.bets.sumStakeOnNumber(userId, round.id, code, [number]);
      const alreadyPlaced = existing.get(number) ?? 0;
      if (alreadyPlaced + slipStake > betType.maxPerNumber) {
        throw limitExceeded(
          `เลข ${number} (${betType.nameTh}) เกินวงเงินสูงสุด ${formatMoney(betType.maxPerNumber)} ต่องวด`,
        );
      }
    }

    return {
      roundId: round.id,
      lotteryId: lottery.id,
      items: quoted,
      totalStake,
      totalPotentialPayout,
    };
  }

  async placeBet(
    userId: string,
    input: PlaceBetInput,
    context: AuditContext,
    nowMs?: number,
  ): Promise<{ bet: Bet; replayed: boolean }> {
    const outcome = await this.idempotency.run<Bet>(
      {
        key: input.idempotencyKey,
        scope: 'place-bet',
        userId,
        payload: { roundId: input.roundId, items: input.items },
      },
      async () => {
        const quote = await this.quote(userId, input, nowMs);
        const round = await this.repos.rounds.findById(quote.roundId);
        const lottery = await this.repos.lotteries.findById(quote.lotteryId);
        if (!round || !lottery) throw notFound('ไม่พบงวดหวย');

        // Re-check the clock immediately before taking money. `nowMs` is only
        // supplied by tests; production always re-reads the real clock here.
        if (!isRoundAcceptingBets(round, nowMs ?? Date.now())) throw roundClosed();

        const betId = id('bet');
        const at = nowIso();
        const items: BetItem[] = quote.items.map((item) => ({
          id: id('bit'),
          betId,
          betTypeCode: item.betTypeCode,
          number: item.number,
          stake: item.stake,
          rateAtBet: item.rateMilli,
          potentialPayout: item.potentialPayout,
          status: 'confirmed',
          payout: 0,
          createdAt: at,
        }));

        const { transaction } = await this.wallet.debit({
          userId,
          type: 'bet',
          amount: quote.totalStake,
          description: `แทงหวย ${lottery.nameTh} งวด ${round.roundCode}`,
          referenceId: betId,
          referenceType: 'bet',
        });

        try {
          const bet = await this.repos.bets.create({
            id: betId,
            reference: reference('BET'),
            userId,
            lotteryId: lottery.id,
            roundId: round.id,
            status: 'confirmed',
            totalStake: quote.totalStake,
            totalPotentialPayout: quote.totalPotentialPayout,
            totalPayout: 0,
            items,
            settledAt: null,
            idempotencyKey: input.idempotencyKey,
            createdAt: at,
            updatedAt: at,
            deletedAt: null,
          });

          await this.notifications.push({
            userId,
            type: 'bet',
            title: 'รับรายการแทงเรียบร้อย',
            body: `บิล ${bet.reference} • ${items.length} รายการ • ${formatMoney(bet.totalStake)}`,
            href: '/account/bets',
          });
          await this.audit.record(context, {
            action: AUDIT_ACTIONS.USER_CREATE_BET,
            resource: 'bet',
            resourceId: bet.id,
            after: {
              reference: bet.reference,
              roundId: bet.roundId,
              totalStake: bet.totalStake,
              items: items.length,
            },
          });

          return bet;
        } catch (error) {
          // Compensating entry: the debit succeeded but the bet did not persist.
          await this.wallet.credit({
            userId,
            type: 'refund',
            amount: quote.totalStake,
            description: `คืนเงินเดิมพันที่บันทึกไม่สำเร็จ (${transaction.id})`,
            referenceId: betId,
            referenceType: 'bet',
          });
          throw error;
        }
      },
    );

    return { bet: outcome.data, replayed: outcome.replayed };
  }

  async getBetForUser(betId: string, userId: string): Promise<Bet> {
    const bet = await this.repos.bets.findById(betId);
    if (!bet || bet.userId !== userId) throw notFound('ไม่พบบิลแทง');
    return bet;
  }
}
