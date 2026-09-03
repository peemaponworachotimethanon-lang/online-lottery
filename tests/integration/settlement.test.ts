import { describe, expect, it } from 'vitest';
import { nowIso } from '@/lib/datetime';
import { id } from '@/lib/ids';
import { bahtToSatang } from '@/lib/money';
import { createHarness, demoUser, idempotencyKey, openThaiRound, type Harness } from '../helpers/harness';

const NOW = Date.UTC(2026, 8, 3, 6, 0, 0);

/** Records a result for a round exactly as the admin action does. */
async function enterResult(
  harness: Harness,
  roundId: string,
  lotteryId: string,
  top3: string,
  bottom2: string,
) {
  const at = nowIso();
  await harness.services.repos.results.create({
    id: id('res'),
    lotteryId,
    roundId,
    top3,
    top2: top3.slice(1),
    bottom2,
    announcedAt: at,
    enteredByUserId: 'admin',
    isFinal: true,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  });
  await harness.services.repos.rounds.update(roundId, { status: 'resulted' });
}

describe('SettlementService', () => {
  /**
   * PHASE 50, Scenario 3 end to end:
   * bet 100 THB on 3-digit top "123" at x850, admin enters 123, settlement pays
   * 85,000 THB into the wallet.
   */
  it('pays a winning bet exactly once at the rate captured when it was placed', async () => {
    const harness = createHarness(NOW);
    const user = await demoUser(harness);
    const { lottery, round } = await openThaiRound(harness, NOW);

    const { bet } = await harness.services.bets.placeBet(
      user.id,
      {
        roundId: round.id,
        items: [{ betTypeCode: 'three-top', number: '123', stakeBaht: 100 }],
        idempotencyKey: idempotencyKey(),
      },
      harness.context,
      NOW,
    );

    expect(await harness.services.wallet.getSpendable(user.id)).toBe(bahtToSatang(9_900));

    await enterResult(harness, round.id, lottery.id, '123', '45');
    const summary = await harness.services.settlement.settleLotteryRound(round.id, harness.context);

    // The seeded round also holds other players' bets, so assert on this bet
    // and this wallet rather than on round-wide totals.
    expect(summary.alreadySettled).toBe(false);
    expect(summary.betsEvaluated).toBeGreaterThanOrEqual(1);
    expect(summary.betsWon).toBeGreaterThanOrEqual(1);
    expect(summary.totalPayout).toBeGreaterThanOrEqual(bahtToSatang(85_000));

    const settled = await harness.services.repos.bets.findById(bet.id);
    expect(settled?.status).toBe('won');
    expect(settled?.totalPayout).toBe(bahtToSatang(85_000));

    // 10,000 − 100 + 85,000
    expect(await harness.services.wallet.getSpendable(user.id)).toBe(bahtToSatang(94_900));

    const winRows = (await harness.services.repos.walletTransactions.findByReference('bet', bet.id)).filter(
      (row) => row.type === 'win',
    );
    expect(winRows).toHaveLength(1);
  });

  it('is idempotent: a second settlement run pays nothing more', async () => {
    const harness = createHarness(NOW);
    const user = await demoUser(harness);
    const { lottery, round } = await openThaiRound(harness, NOW);

    await harness.services.bets.placeBet(
      user.id,
      {
        roundId: round.id,
        items: [{ betTypeCode: 'three-top', number: '123', stakeBaht: 100 }],
        idempotencyKey: idempotencyKey(),
      },
      harness.context,
      NOW,
    );

    await enterResult(harness, round.id, lottery.id, '123', '45');
    await harness.services.settlement.settleLotteryRound(round.id, harness.context);
    const balanceAfterFirst = await harness.services.wallet.getSpendable(user.id);

    const second = await harness.services.settlement.settleLotteryRound(round.id, harness.context);
    expect(second.alreadySettled).toBe(true);
    expect(second.totalPayout).toBe(0);
    expect(await harness.services.wallet.getSpendable(user.id)).toBe(balanceAfterFirst);

    const check = await harness.services.wallet.verifyLedger(user.id);
    expect(check.consistent).toBe(true);
  });

  it('marks a losing bet lost and pays nothing', async () => {
    const harness = createHarness(NOW);
    const user = await demoUser(harness);
    const { lottery, round } = await openThaiRound(harness, NOW);

    const { bet } = await harness.services.bets.placeBet(
      user.id,
      {
        roundId: round.id,
        items: [{ betTypeCode: 'three-top', number: '999', stakeBaht: 100 }],
        idempotencyKey: idempotencyKey(),
      },
      harness.context,
      NOW,
    );

    await enterResult(harness, round.id, lottery.id, '123', '45');
    await harness.services.settlement.settleLotteryRound(round.id, harness.context);

    expect((await harness.services.repos.bets.findById(bet.id))?.status).toBe('lost');
    expect(await harness.services.wallet.getSpendable(user.id)).toBe(bahtToSatang(9_900));
  });

  it('settles a mixed slip per item, not per bet', async () => {
    const harness = createHarness(NOW);
    const user = await demoUser(harness);
    const { lottery, round } = await openThaiRound(harness, NOW);

    const { bet } = await harness.services.bets.placeBet(
      user.id,
      {
        roundId: round.id,
        items: [
          { betTypeCode: 'three-top', number: '123', stakeBaht: 10 }, // wins  x850
          { betTypeCode: 'two-bottom', number: '45', stakeBaht: 10 }, // wins  x90
          { betTypeCode: 'two-top', number: '99', stakeBaht: 10 }, // loses
        ],
        idempotencyKey: idempotencyKey(),
      },
      harness.context,
      NOW,
    );

    await enterResult(harness, round.id, lottery.id, '123', '45');
    await harness.services.settlement.settleLotteryRound(round.id, harness.context);

    const settled = await harness.services.repos.bets.findById(bet.id);
    expect(settled?.status).toBe('won');
    expect(settled?.totalPayout).toBe(bahtToSatang(8_500) + bahtToSatang(900));
    expect(settled?.items.filter((item) => item.status === 'won')).toHaveLength(2);
    expect(settled?.items.filter((item) => item.status === 'lost')).toHaveLength(1);
  });

  it('refuses to settle a round that has no result yet', async () => {
    const harness = createHarness(NOW);
    const { round } = await openThaiRound(harness, NOW);
    await expect(
      harness.services.settlement.settleLotteryRound(round.id, harness.context),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('previews a settlement without moving money', async () => {
    const harness = createHarness(NOW);
    const user = await demoUser(harness);
    const { round } = await openThaiRound(harness, NOW);

    await harness.services.bets.placeBet(
      user.id,
      {
        roundId: round.id,
        items: [{ betTypeCode: 'three-top', number: '123', stakeBaht: 100 }],
        idempotencyKey: idempotencyKey(),
      },
      harness.context,
      NOW,
    );

    const before = await harness.services.wallet.getSpendable(user.id);
    const preview = await harness.services.settlement.previewRound(round.id, {
      top3: '123',
      top2: '23',
      bottom2: '45',
    });

    expect(preview.winners).toBeGreaterThanOrEqual(1);
    expect(preview.payout).toBeGreaterThanOrEqual(bahtToSatang(85_000));
    expect(await harness.services.wallet.getSpendable(user.id)).toBe(before);
  });

  it('keeps paying the old rate after the payout rate is changed', async () => {
    const harness = createHarness(NOW);
    const user = await demoUser(harness);
    const { lottery, round } = await openThaiRound(harness, NOW);

    const { bet } = await harness.services.bets.placeBet(
      user.id,
      {
        roundId: round.id,
        items: [{ betTypeCode: 'three-top', number: '123', stakeBaht: 100 }],
        idempotencyKey: idempotencyKey(),
      },
      harness.context,
      NOW,
    );

    // The house slashes the rate after the bet was accepted.
    const rates = await harness.services.repos.payoutRates.list();
    const target = rates.find((rate) => rate.betTypeCode === 'three-top');
    await harness.services.repos.payoutRates.update(target!.id, { rateMilli: 1_000 });

    await enterResult(harness, round.id, lottery.id, '123', '45');
    await harness.services.settlement.settleLotteryRound(round.id, harness.context);

    // Still paid at x850, the rate captured on the bet item.
    const settled = await harness.services.repos.bets.findById(bet.id);
    expect(settled?.totalPayout).toBe(bahtToSatang(85_000));
  });
});
