import { describe, expect, it } from 'vitest';
import { bahtToSatang } from '@/lib/money';
import { createHarness, demoUser, idempotencyKey, openThaiRound } from '../helpers/harness';

const NOW = Date.UTC(2026, 8, 3, 6, 0, 0);

describe('BetService', () => {
  it('prices the headline demo scenario: 100 THB on 3-digit top at x850', async () => {
    const harness = createHarness(NOW);
    const user = await demoUser(harness);
    const { round } = await openThaiRound(harness, NOW);

    const quote = await harness.services.bets.quote(
      user.id,
      {
        roundId: round.id,
        items: [{ betTypeCode: 'three-top', number: '123', stakeBaht: 100 }],
        idempotencyKey: idempotencyKey(),
      },
      NOW,
    );

    expect(quote.totalStake).toBe(bahtToSatang(100));
    expect(quote.totalPotentialPayout).toBe(bahtToSatang(85_000));
    expect(quote.items[0]?.rateMilli).toBe(850_000);
  });

  it('debits the wallet and records an immutable bet', async () => {
    const harness = createHarness(NOW);
    const user = await demoUser(harness);
    const { round } = await openThaiRound(harness, NOW);

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

    expect(bet.status).toBe('confirmed');
    expect(bet.items).toHaveLength(1);
    expect(bet.items[0]?.rateAtBet).toBe(850_000);

    const wallet = await harness.services.wallet.getWallet(user.id);
    expect(wallet.balance).toBe(bahtToSatang(9_900));

    const ledger = await harness.services.repos.walletTransactions.findByReference('bet', bet.id);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.amount).toBe(-bahtToSatang(100));
  });

  it('is idempotent: the same key never places two bets', async () => {
    const harness = createHarness(NOW);
    const user = await demoUser(harness);
    const { round } = await openThaiRound(harness, NOW);
    const key = idempotencyKey();
    const input = {
      roundId: round.id,
      items: [{ betTypeCode: 'two-top', number: '23', stakeBaht: 50 }],
      idempotencyKey: key,
    };

    const first = await harness.services.bets.placeBet(user.id, input, harness.context, NOW);
    const second = await harness.services.bets.placeBet(user.id, input, harness.context, NOW);

    expect(second.replayed).toBe(true);
    expect(second.bet.id).toBe(first.bet.id);

    const wallet = await harness.services.wallet.getWallet(user.id);
    expect(wallet.balance).toBe(bahtToSatang(9_950));
  });

  it('rejects a bet on a closed round', async () => {
    const harness = createHarness(NOW);
    const user = await demoUser(harness);
    const { round } = await openThaiRound(harness, NOW);
    const afterClose = new Date(round.closeAt).getTime() + 1000;

    await expect(
      harness.services.bets.quote(
        user.id,
        {
          roundId: round.id,
          items: [{ betTypeCode: 'three-top', number: '123', stakeBaht: 100 }],
          idempotencyKey: idempotencyKey(),
        },
        afterClose,
      ),
    ).rejects.toMatchObject({ code: 'ROUND_CLOSED' });
  });

  it('rejects a number whose length does not match the bet type', async () => {
    const harness = createHarness(NOW);
    const user = await demoUser(harness);
    const { round } = await openThaiRound(harness, NOW);

    await expect(
      harness.services.bets.quote(
        user.id,
        {
          roundId: round.id,
          items: [{ betTypeCode: 'three-top', number: '12', stakeBaht: 100 }],
          idempotencyKey: idempotencyKey(),
        },
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('enforces the per-number exposure limit across separate slips', async () => {
    const harness = createHarness(NOW);
    const user = await demoUser(harness);
    const { round } = await openThaiRound(harness, NOW);

    // three-top maxPerNumber is 50,000 THB; the wallet cannot fund that, so we
    // lower the ceiling instead of inflating the balance.
    const betType = await harness.services.repos.betTypes.findByCode('three-top');
    await harness.services.repos.betTypes.update(betType!.id, {
      maxPerNumber: bahtToSatang(150),
    });

    await harness.services.bets.placeBet(
      user.id,
      {
        roundId: round.id,
        items: [{ betTypeCode: 'three-top', number: '777', stakeBaht: 100 }],
        idempotencyKey: idempotencyKey(),
      },
      harness.context,
      NOW,
    );

    await expect(
      harness.services.bets.quote(
        user.id,
        {
          roundId: round.id,
          items: [{ betTypeCode: 'three-top', number: '777', stakeBaht: 100 }],
          idempotencyKey: idempotencyKey(),
        },
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  });

  it('rejects a slip that exceeds the wallet balance and leaves no partial state', async () => {
    const harness = createHarness(NOW);
    const user = await demoUser(harness);
    const { round } = await openThaiRound(harness, NOW);

    await expect(
      harness.services.bets.placeBet(
        user.id,
        {
          roundId: round.id,
          items: [{ betTypeCode: 'two-top', number: '11', stakeBaht: 20_000 }],
          idempotencyKey: idempotencyKey(),
        },
        harness.context,
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });

    const wallet = await harness.services.wallet.getWallet(user.id);
    expect(wallet.balance).toBe(bahtToSatang(10_000));
    const bets = await harness.services.repos.bets.findMany({ userId: user.id, roundId: round.id });
    expect(bets.total).toBe(0);
  });

  /** Twenty concurrent 100 THB bets against a 1,000 THB balance. */
  it('never lets concurrent bets overdraw the wallet', async () => {
    const harness = createHarness(NOW);
    const user = await demoUser(harness);
    const { round } = await openThaiRound(harness, NOW);

    await harness.services.wallet.debit({
      userId: user.id,
      type: 'adjustment',
      amount: bahtToSatang(9_000),
      description: 'set up concurrency test',
    });

    const outcomes = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        harness.services.bets
          .placeBet(
            user.id,
            {
              roundId: round.id,
              items: [{ betTypeCode: 'two-top', number: String(index % 10).padStart(2, '0'), stakeBaht: 100 }],
              idempotencyKey: idempotencyKey(`concurrent-${index}`),
            },
            harness.context,
            NOW,
          )
          .then(() => 'ok' as const)
          .catch(() => 'rejected' as const),
      ),
    );

    expect(outcomes.filter((outcome) => outcome === 'ok')).toHaveLength(10);
    const wallet = await harness.services.wallet.getWallet(user.id);
    expect(wallet.balance).toBe(0);

    const check = await harness.services.wallet.verifyLedger(user.id);
    expect(check.consistent).toBe(true);
  });
});
