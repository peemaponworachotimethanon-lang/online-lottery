import { describe, expect, it } from 'vitest';
import { bahtToSatang } from '@/lib/money';
import { createHarness, demoUser } from '../helpers/harness';

describe('WalletService', () => {
  it('seeds the demo user with exactly 10,000 THB', async () => {
    const harness = createHarness();
    const user = await demoUser(harness);
    const wallet = await harness.services.wallet.getWallet(user.id);
    expect(wallet.balance).toBe(bahtToSatang(10_000));
    expect(wallet.held).toBe(0);
  });

  it('records balanceBefore/balanceAfter on every entry', async () => {
    const harness = createHarness();
    const user = await demoUser(harness);

    const { transaction } = await harness.services.wallet.credit({
      userId: user.id,
      type: 'deposit',
      amount: bahtToSatang(1_000),
      description: 'test deposit',
    });

    expect(transaction.balanceBefore).toBe(bahtToSatang(10_000));
    expect(transaction.balanceAfter).toBe(bahtToSatang(11_000));
    expect(transaction.status).toBe('completed');
  });

  it('refuses a debit that would overdraw the wallet', async () => {
    const harness = createHarness();
    const user = await demoUser(harness);

    await expect(
      harness.services.wallet.debit({
        userId: user.id,
        type: 'bet',
        amount: bahtToSatang(10_001),
        description: 'too big',
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });

    const wallet = await harness.services.wallet.getWallet(user.id);
    expect(wallet.balance).toBe(bahtToSatang(10_000));
  });

  it('keeps balance equal to the sum of the ledger for the demo user', async () => {
    const harness = createHarness();
    const user = await demoUser(harness);
    await harness.services.wallet.credit({
      userId: user.id,
      type: 'adjustment',
      amount: bahtToSatang(250),
      description: 'adjust up',
    });
    await harness.services.wallet.debit({
      userId: user.id,
      type: 'adjustment',
      amount: bahtToSatang(100),
      description: 'adjust down',
    });

    const check = await harness.services.wallet.verifyLedger(user.id);
    expect(check.consistent).toBe(true);
    expect(check.balance).toBe(bahtToSatang(10_150));
  });

  it('keeps the whole seeded platform ledger consistent', async () => {
    const harness = createHarness();
    const check = await harness.services.wallet.verifyLedger();
    expect(check.consistent).toBe(true);
  });

  /**
   * PHASE 42 scenario: balance 1,000; twenty concurrent 100 THB debits.
   * At most ten may succeed and the balance may never go negative.
   */
  it('serialises concurrent debits without overdrawing', async () => {
    const harness = createHarness();
    const user = await demoUser(harness);

    // Bring the wallet down to exactly 1,000 THB.
    await harness.services.wallet.debit({
      userId: user.id,
      type: 'adjustment',
      amount: bahtToSatang(9_000),
      description: 'set up concurrency test',
    });

    const attempts = Array.from({ length: 20 }, (_, index) =>
      harness.services.wallet
        .debit({
          userId: user.id,
          type: 'bet',
          amount: bahtToSatang(100),
          description: `concurrent bet ${index}`,
        })
        .then(() => 'ok' as const)
        .catch(() => 'rejected' as const),
    );

    const outcomes = await Promise.all(attempts);
    const succeeded = outcomes.filter((outcome) => outcome === 'ok').length;

    expect(succeeded).toBe(10);
    const wallet = await harness.services.wallet.getWallet(user.id);
    expect(wallet.balance).toBe(0);
    expect(wallet.balance).toBeGreaterThanOrEqual(0);

    const check = await harness.services.wallet.verifyLedger(user.id);
    expect(check.consistent).toBe(true);
  });
});
