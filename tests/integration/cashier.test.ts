import { describe, expect, it } from 'vitest';
import { bahtToSatang } from '@/lib/money';
import { createHarness, demoUser, idempotencyKey } from '../helpers/harness';

const BANK = {
  bankName: 'ธนาคารทดสอบ',
  bankAccountNumber: '123-456789-0',
  bankAccountName: 'ผู้ใช้ทดลอง (Demo)',
};

describe('CashierService — deposits', () => {
  it('credits the wallet and records a completed deposit', async () => {
    const harness = createHarness();
    const user = await demoUser(harness);

    const { deposit } = await harness.services.cashier.createMockDeposit(
      user.id,
      { amountBaht: 1_000, method: 'qr', idempotencyKey: idempotencyKey() },
      harness.context,
    );

    expect(deposit.status).toBe('completed');
    expect(deposit.walletTransactionId).not.toBeNull();
    expect(await harness.services.wallet.getSpendable(user.id)).toBe(bahtToSatang(11_000));
  });

  it('is idempotent: the same key never credits twice', async () => {
    const harness = createHarness();
    const user = await demoUser(harness);
    const key = idempotencyKey();
    const input = { amountBaht: 1_000, method: 'qr' as const, idempotencyKey: key };

    const first = await harness.services.cashier.createMockDeposit(user.id, input, harness.context);
    const second = await harness.services.cashier.createMockDeposit(user.id, input, harness.context);

    expect(second.replayed).toBe(true);
    expect(second.deposit.id).toBe(first.deposit.id);
    expect(await harness.services.wallet.getSpendable(user.id)).toBe(bahtToSatang(11_000));
  });

  it('rejects a reused key carrying a different payload', async () => {
    const harness = createHarness();
    const user = await demoUser(harness);
    const key = idempotencyKey();

    await harness.services.cashier.createMockDeposit(
      user.id,
      { amountBaht: 1_000, method: 'qr', idempotencyKey: key },
      harness.context,
    );

    await expect(
      harness.services.cashier.createMockDeposit(
        user.id,
        { amountBaht: 5_000, method: 'qr', idempotencyKey: key },
        harness.context,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('CashierService — withdrawals (hold / debit / release)', () => {
  it('holds funds at request time so they cannot be spent twice', async () => {
    const harness = createHarness();
    const user = await demoUser(harness);

    const { withdrawal } = await harness.services.cashier.requestWithdrawal(
      user.id,
      { amountBaht: 5_000, ...BANK, idempotencyKey: idempotencyKey() },
      harness.context,
    );

    expect(withdrawal.status).toBe('pending');
    expect(withdrawal.holdTransactionId).not.toBeNull();

    const wallet = await harness.services.wallet.getWallet(user.id);
    expect(wallet.balance).toBe(bahtToSatang(5_000));
    expect(wallet.held).toBe(bahtToSatang(5_000));

    // The held funds are genuinely unspendable.
    await expect(
      harness.services.wallet.debit({
        userId: user.id,
        type: 'bet',
        amount: bahtToSatang(6_000),
        description: 'attempt to spend held funds',
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
  });

  it('approving releases the hold and leaves the balance debited', async () => {
    const harness = createHarness();
    const user = await demoUser(harness);

    const { withdrawal } = await harness.services.cashier.requestWithdrawal(
      user.id,
      { amountBaht: 5_000, ...BANK, idempotencyKey: idempotencyKey() },
      harness.context,
    );

    const approved = await harness.services.cashier.reviewWithdrawal(
      withdrawal.id,
      'approve',
      'ตรวจสอบแล้ว',
      harness.context,
    );

    expect(approved.status).toBe('approved');
    expect(approved.settlementTransactionId).not.toBeNull();

    const wallet = await harness.services.wallet.getWallet(user.id);
    expect(wallet.balance).toBe(bahtToSatang(5_000));
    expect(wallet.held).toBe(0);

    const check = await harness.services.wallet.verifyLedger(user.id);
    expect(check.consistent).toBe(true);
  });

  it('rejecting returns the money to the spendable balance', async () => {
    const harness = createHarness();
    const user = await demoUser(harness);

    const { withdrawal } = await harness.services.cashier.requestWithdrawal(
      user.id,
      { amountBaht: 5_000, ...BANK, idempotencyKey: idempotencyKey() },
      harness.context,
    );

    const rejected = await harness.services.cashier.reviewWithdrawal(
      withdrawal.id,
      'reject',
      'ชื่อบัญชีไม่ตรง',
      harness.context,
    );

    expect(rejected.status).toBe('rejected');
    const wallet = await harness.services.wallet.getWallet(user.id);
    expect(wallet.balance).toBe(bahtToSatang(10_000));
    expect(wallet.held).toBe(0);

    const check = await harness.services.wallet.verifyLedger(user.id);
    expect(check.consistent).toBe(true);
  });

  it('refuses a withdrawal larger than the spendable balance', async () => {
    const harness = createHarness();
    const user = await demoUser(harness);

    await expect(
      harness.services.cashier.requestWithdrawal(
        user.id,
        { amountBaht: 20_000, ...BANK, idempotencyKey: idempotencyKey() },
        harness.context,
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
  });

  it('refuses to review the same withdrawal twice', async () => {
    const harness = createHarness();
    const user = await demoUser(harness);

    const { withdrawal } = await harness.services.cashier.requestWithdrawal(
      user.id,
      { amountBaht: 1_000, ...BANK, idempotencyKey: idempotencyKey() },
      harness.context,
    );

    await harness.services.cashier.reviewWithdrawal(withdrawal.id, 'approve', '', harness.context);
    await expect(
      harness.services.cashier.reviewWithdrawal(withdrawal.id, 'approve', '', harness.context),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('CashierService — wallet adjustment', () => {
  it('credits through the ledger and writes an audit record', async () => {
    const harness = createHarness();
    const user = await demoUser(harness);

    await harness.services.cashier.adjustWallet(
      { userId: user.id, amountBaht: 250, reason: 'ชดเชยเคสทดสอบ' },
      harness.context,
    );

    expect(await harness.services.wallet.getSpendable(user.id)).toBe(bahtToSatang(10_250));

    const logs = await harness.services.repos.audit.findMany({ action: 'ADMIN_ADJUST_WALLET' });
    expect(logs.total).toBeGreaterThan(0);

    const check = await harness.services.wallet.verifyLedger(user.id);
    expect(check.consistent).toBe(true);
  });

  it('cannot debit a user below zero', async () => {
    const harness = createHarness();
    const user = await demoUser(harness);

    await expect(
      harness.services.cashier.adjustWallet(
        { userId: user.id, amountBaht: -20_000, reason: 'หักเกินยอด' },
        harness.context,
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
  });
});
