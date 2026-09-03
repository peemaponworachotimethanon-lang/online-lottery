import { nowIso } from '@/lib/datetime';
import { conflict, insufficientFunds, validation } from '@/lib/errors';
import { id } from '@/lib/ids';
import { assertSatang, type Satang } from '@/lib/money';
import { getWalletLock } from '@/providers/lock';
import type { RepositoryBundle } from '@/repositories/contracts';
import type { Wallet, WalletTransaction, WalletTxType } from '@/types/domain';

/**
 * WalletService — the ONLY component permitted to change a balance.
 *
 * Invariants enforced here:
 *   I1. Every balance change writes exactly one ledger row, and that row records
 *       balanceBefore / balanceAfter.
 *   I2. `wallet.balance` always equals the sum of `amount` over completed rows.
 *   I3. Spendable balance can never go negative. `held` can never exceed what was
 *       actually reserved.
 *
 * Concurrency: reads the wallet, computes the new state, then commits with a
 * compare-and-set on `version`. A lost race returns null and the operation is
 * retried from a fresh read. This is safe across processes, which a mutex is not.
 */

export interface PostEntryInput {
  userId: string;
  type: WalletTxType;
  /** Signed satang. Positive credits the wallet, negative debits it. */
  amount: Satang;
  description: string;
  referenceId?: string | null;
  referenceType?: string | null;
  /** Additional change to `held`, applied atomically with the balance change. */
  heldDelta?: Satang;
}

const MAX_ATTEMPTS = 5;

export class WalletService {
  constructor(private readonly repos: RepositoryBundle) {}

  async getWallet(userId: string): Promise<Wallet> {
    return this.repos.wallets.requireByUserId(userId);
  }

  /** Spendable = balance. `held` is already excluded from it. */
  async getSpendable(userId: string): Promise<Satang> {
    const wallet = await this.repos.wallets.requireByUserId(userId);
    return wallet.balance;
  }

  async createWallet(userId: string): Promise<Wallet> {
    const at = nowIso();
    return this.repos.wallets.create({
      id: id('wal'),
      userId,
      balance: 0,
      held: 0,
      currency: 'THB',
      version: 0,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    });
  }

  /**
   * Applies one signed ledger entry.
   * Debits are rejected when they would take the spendable balance below zero —
   * this is the single check that makes overdraft impossible.
   */
  async post(input: PostEntryInput): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
    assertSatang(input.amount, 'amount');
    if (input.heldDelta !== undefined) assertSatang(input.heldDelta, 'heldDelta');

    const lock = getWalletLock();
    return lock.run(`wallet:${input.userId}`, async () => {
      let lastError: unknown = null;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const wallet = await this.repos.wallets.requireByUserId(input.userId);

        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore + input.amount;
        const heldAfter = wallet.held + (input.heldDelta ?? 0);

        if (balanceAfter < 0) throw insufficientFunds();
        if (heldAfter < 0) throw conflict('ยอดเงินที่กันไว้ไม่ถูกต้อง');

        const committed = await this.repos.wallets.updateBalance(wallet.id, wallet.version, {
          balance: balanceAfter,
          held: heldAfter,
        });

        if (!committed) {
          // Another writer won; re-read and try again.
          lastError = conflict('กระเป๋าเงินถูกแก้ไขพร้อมกัน กรุณาลองใหม่');
          continue;
        }

        const at = nowIso();
        const transaction = await this.repos.walletTransactions.append({
          id: id('wtx'),
          walletId: wallet.id,
          userId: input.userId,
          type: input.type,
          amount: input.amount,
          balanceBefore,
          balanceAfter,
          status: 'completed',
          referenceId: input.referenceId ?? null,
          referenceType: input.referenceType ?? null,
          description: input.description,
          completedAt: at,
          createdAt: at,
          updatedAt: at,
          deletedAt: null,
        });

        return { wallet: committed, transaction };
      }

      throw lastError ?? conflict('ไม่สามารถอัปเดตกระเป๋าเงินได้');
    });
  }

  /* -------------------------------------------------------------- */
  /* Named operations — callers use these, never `post` directly.    */
  /* -------------------------------------------------------------- */

  async credit(input: Omit<PostEntryInput, 'amount'> & { amount: Satang }) {
    if (input.amount <= 0) throw validation('จำนวนเงินฝากต้องมากกว่า 0');
    return this.post(input);
  }

  async debit(input: Omit<PostEntryInput, 'amount'> & { amount: Satang }) {
    if (input.amount <= 0) throw validation('จำนวนเงินที่หักต้องมากกว่า 0');
    return this.post({ ...input, amount: -input.amount });
  }

  /**
   * Withdrawal step 1 — HOLD.
   * Moves funds out of the spendable balance into `held` so they cannot be spent
   * while a withdrawal request is under review. Ledger row: `hold`, amount -X.
   */
  async hold(input: { userId: string; amount: Satang; referenceId: string; description: string }) {
    if (input.amount <= 0) throw validation('จำนวนเงินต้องมากกว่า 0');
    return this.post({
      userId: input.userId,
      type: 'hold',
      amount: -input.amount,
      heldDelta: input.amount,
      description: input.description,
      referenceId: input.referenceId,
      referenceType: 'withdrawal',
    });
  }

  /**
   * Withdrawal step 2a — SETTLE (approve).
   * The money has already left the spendable balance at hold time, so this only
   * releases the reservation and writes a zero-amount marker row that records the
   * completion in the ledger. Keeping the row makes the withdrawal lifecycle
   * fully reconstructible from `wallet_transactions` alone.
   */
  async settleHold(input: { userId: string; amount: Satang; referenceId: string; description: string }) {
    return this.post({
      userId: input.userId,
      type: 'withdraw',
      amount: 0,
      heldDelta: -input.amount,
      description: input.description,
      referenceId: input.referenceId,
      referenceType: 'withdrawal',
    });
  }

  /**
   * Withdrawal step 2b — RELEASE (reject / cancel).
   * Returns the reserved funds to the spendable balance.
   */
  async releaseHold(input: { userId: string; amount: Satang; referenceId: string; description: string }) {
    return this.post({
      userId: input.userId,
      type: 'release',
      amount: input.amount,
      heldDelta: -input.amount,
      description: input.description,
      referenceId: input.referenceId,
      referenceType: 'withdrawal',
    });
  }

  /**
   * Verifies invariant I2 for one user (or the whole platform).
   * Exposed so tests and the admin console can assert ledger integrity.
   */
  async verifyLedger(userId?: string): Promise<{ consistent: boolean; balance: Satang; ledgerSum: Satang }> {
    const ledgerSum = await this.repos.walletTransactions.sumAllCompleted(userId);
    if (userId) {
      const wallet = await this.repos.wallets.requireByUserId(userId);
      return { consistent: wallet.balance === ledgerSum, balance: wallet.balance, ledgerSum };
    }
    let balance = 0;
    let page = 1;
    for (;;) {
      const result = await this.repos.users.findMany({ page, pageSize: 100, status: 'all' });
      for (const user of result.items) {
        const wallet = await this.repos.wallets.findByUserId(user.id);
        if (wallet) balance += wallet.balance;
      }
      if (page >= result.pageCount) break;
      page += 1;
    }
    return { consistent: balance === ledgerSum, balance, ledgerSum };
  }
}
