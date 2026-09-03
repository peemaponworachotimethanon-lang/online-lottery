import { nowIso } from '@/lib/datetime';
import { conflict, forbidden, insufficientFunds, notFound } from '@/lib/errors';
import { id, reference } from '@/lib/ids';
import { bahtToSatang, formatMoney } from '@/lib/money';
import type { RepositoryBundle } from '@/repositories/contracts';
import type { DepositInput, WithdrawalInput } from '@/schemas/betting';
import type { Deposit, Withdrawal } from '@/types/domain';
import { AUDIT_ACTIONS, type AuditContext, type AuditService } from './audit-service';
import type { IdempotencyService } from './idempotency-service';
import type { NotificationService } from './notification-service';
import type { WalletService } from './wallet-service';

/**
 * CashierService — deposits and withdrawals.
 *
 * WITHDRAWAL MODEL (hold / debit / release), chosen deliberately:
 *   request  -> `hold`    : amount leaves the spendable balance, `held` += amount
 *   approve  -> `withdraw`: `held` -= amount, zero-amount ledger marker recorded
 *   reject   -> `release` : `held` -= amount, amount credited back
 *
 * Holding at request time is what makes the flow safe: a user cannot request a
 * withdrawal and then spend the same money on bets while it waits for review.
 * The alternative (debit only on approval) allows exactly that double-spend.
 */
export class CashierService {
  constructor(
    private readonly repos: RepositoryBundle,
    private readonly wallet: WalletService,
    private readonly idempotency: IdempotencyService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  /* ---------------------------- deposits ---------------------------- */

  /**
   * Mock deposit. In the demo this settles instantly; in production the row is
   * created `pending` and only a verified payment-provider webhook completes it.
   */
  async createMockDeposit(
    userId: string,
    input: DepositInput,
    context: AuditContext,
  ): Promise<{ deposit: Deposit; replayed: boolean }> {
    const outcome = await this.idempotency.run<Deposit>(
      {
        key: input.idempotencyKey,
        scope: 'deposit',
        userId,
        payload: { amountBaht: input.amountBaht, method: input.method },
      },
      async () => {
        const amount = bahtToSatang(input.amountBaht);
        const at = nowIso();
        const depositId = id('dep');

        await this.repos.deposits.create({
          id: depositId,
          reference: reference('DEP'),
          userId,
          amount,
          method: input.method,
          status: 'pending',
          walletTransactionId: null,
          reviewedByUserId: null,
          reviewedAt: null,
          note: null,
          idempotencyKey: input.idempotencyKey,
          createdAt: at,
          updatedAt: at,
          deletedAt: null,
        });

        const { transaction } = await this.wallet.credit({
          userId,
          type: 'deposit',
          amount,
          description: `ฝากเงินผ่าน ${input.method === 'qr' ? 'QR Payment' : 'โอนผ่านธนาคาร'} (โหมดสาธิต)`,
          referenceId: depositId,
          referenceType: 'deposit',
        });

        const completed = await this.repos.deposits.update(depositId, {
          status: 'completed',
          walletTransactionId: transaction.id,
          reviewedAt: nowIso(),
        });

        await this.notifications.push({
          userId,
          type: 'deposit',
          title: 'ฝากเงินสำเร็จ',
          body: `${formatMoney(amount)} เข้าบัญชีเรียบร้อยแล้ว`,
          href: '/account/transactions',
        });
        await this.audit.record(context, {
          action: AUDIT_ACTIONS.USER_CREATE_DEPOSIT,
          resource: 'deposit',
          resourceId: depositId,
          after: { amount, method: input.method, status: 'completed' },
        });

        return completed;
      },
    );

    return { deposit: outcome.data, replayed: outcome.replayed };
  }

  async reviewDeposit(
    depositId: string,
    decision: 'approve' | 'reject',
    note: string,
    context: AuditContext,
  ): Promise<Deposit> {
    const deposit = await this.repos.deposits.findById(depositId);
    if (!deposit) throw notFound('ไม่พบรายการฝากเงิน');
    if (deposit.status !== 'pending') throw conflict('รายการนี้ถูกดำเนินการไปแล้ว');
    if (!context.actorId) throw forbidden();

    if (decision === 'reject') {
      const updated = await this.repos.deposits.update(depositId, {
        status: 'rejected',
        note: note || 'ไม่พบรายการโอนเข้า',
        reviewedByUserId: context.actorId,
        reviewedAt: nowIso(),
      });
      await this.notifications.push({
        userId: deposit.userId,
        type: 'deposit',
        title: 'รายการฝากเงินถูกปฏิเสธ',
        body: `รายการ ${deposit.reference} ไม่ผ่านการตรวจสอบ`,
        href: '/account/deposits',
      });
      await this.audit.record(context, {
        action: AUDIT_ACTIONS.ADMIN_REJECT_DEPOSIT,
        resource: 'deposit',
        resourceId: depositId,
        before: { status: 'pending' },
        after: { status: 'rejected', note },
      });
      return updated;
    }

    const { transaction } = await this.wallet.credit({
      userId: deposit.userId,
      type: 'deposit',
      amount: deposit.amount,
      description: `ฝากเงินอนุมัติโดยเจ้าหน้าที่ • ${deposit.reference}`,
      referenceId: deposit.id,
      referenceType: 'deposit',
    });

    const updated = await this.repos.deposits.update(depositId, {
      status: 'completed',
      walletTransactionId: transaction.id,
      reviewedByUserId: context.actorId,
      reviewedAt: nowIso(),
      note: note || null,
    });

    await this.notifications.push({
      userId: deposit.userId,
      type: 'deposit',
      title: 'ฝากเงินสำเร็จ',
      body: `${formatMoney(deposit.amount)} เข้าบัญชีเรียบร้อยแล้ว`,
      href: '/account/transactions',
    });
    await this.audit.record(context, {
      action: AUDIT_ACTIONS.ADMIN_APPROVE_DEPOSIT,
      resource: 'deposit',
      resourceId: depositId,
      before: { status: 'pending' },
      after: { status: 'completed', amount: deposit.amount },
    });

    return updated;
  }

  /* -------------------------- withdrawals --------------------------- */

  async requestWithdrawal(
    userId: string,
    input: WithdrawalInput,
    context: AuditContext,
  ): Promise<{ withdrawal: Withdrawal; replayed: boolean }> {
    const outcome = await this.idempotency.run<Withdrawal>(
      {
        key: input.idempotencyKey,
        scope: 'withdrawal',
        userId,
        payload: {
          amountBaht: input.amountBaht,
          bankName: input.bankName,
          bankAccountNumber: input.bankAccountNumber,
        },
      },
      async () => {
        const amount = bahtToSatang(input.amountBaht);
        const wallet = await this.wallet.getWallet(userId);
        if (wallet.balance < amount) throw insufficientFunds();

        const at = nowIso();
        const withdrawalId = id('wdr');
        const withdrawal = await this.repos.withdrawals.create({
          id: withdrawalId,
          reference: reference('WDR'),
          userId,
          amount,
          bankName: input.bankName,
          bankAccountNumber: input.bankAccountNumber,
          bankAccountName: input.bankAccountName,
          status: 'pending',
          holdTransactionId: null,
          settlementTransactionId: null,
          reviewedByUserId: null,
          reviewedAt: null,
          note: null,
          idempotencyKey: input.idempotencyKey,
          createdAt: at,
          updatedAt: at,
          deletedAt: null,
        });

        // Reserve immediately so the funds cannot be spent while under review.
        const { transaction } = await this.wallet.hold({
          userId,
          amount,
          referenceId: withdrawalId,
          description: `กันวงเงินสำหรับคำขอถอน ${withdrawal.reference}`,
        });

        const updated = await this.repos.withdrawals.update(withdrawalId, {
          holdTransactionId: transaction.id,
        });

        await this.notifications.push({
          userId,
          type: 'withdrawal',
          title: 'รับคำขอถอนเงินแล้ว',
          body: `${formatMoney(amount)} • รอการตรวจสอบ`,
          href: '/account/withdrawals',
        });
        await this.audit.record(context, {
          action: AUDIT_ACTIONS.USER_CREATE_WITHDRAWAL,
          resource: 'withdrawal',
          resourceId: withdrawalId,
          after: { amount, bankName: input.bankName },
        });

        return updated;
      },
    );

    return { withdrawal: outcome.data, replayed: outcome.replayed };
  }

  async reviewWithdrawal(
    withdrawalId: string,
    decision: 'approve' | 'reject',
    note: string,
    context: AuditContext,
  ): Promise<Withdrawal> {
    const withdrawal = await this.repos.withdrawals.findById(withdrawalId);
    if (!withdrawal) throw notFound('ไม่พบรายการถอนเงิน');
    if (withdrawal.status !== 'pending') throw conflict('รายการนี้ถูกดำเนินการไปแล้ว');
    if (!context.actorId) throw forbidden();

    const reviewedAt = nowIso();

    if (decision === 'approve') {
      const { transaction } = await this.wallet.settleHold({
        userId: withdrawal.userId,
        amount: withdrawal.amount,
        referenceId: withdrawal.id,
        description: `ถอนเงินสำเร็จ ${withdrawal.reference}`,
      });
      const updated = await this.repos.withdrawals.update(withdrawalId, {
        status: 'approved',
        settlementTransactionId: transaction.id,
        reviewedByUserId: context.actorId,
        reviewedAt,
        note: note || null,
      });
      await this.notifications.push({
        userId: withdrawal.userId,
        type: 'withdrawal',
        title: 'คำขอถอนเงินได้รับการอนุมัติ',
        body: `${formatMoney(withdrawal.amount)} โอนเข้าบัญชีเรียบร้อย (โหมดสาธิต)`,
        href: '/account/withdrawals',
      });
      await this.audit.record(context, {
        action: AUDIT_ACTIONS.ADMIN_APPROVE_WITHDRAWAL,
        resource: 'withdrawal',
        resourceId: withdrawalId,
        before: { status: 'pending', amount: withdrawal.amount },
        after: { status: 'approved', settlementTransactionId: transaction.id },
      });
      return updated;
    }

    const { transaction } = await this.wallet.releaseHold({
      userId: withdrawal.userId,
      amount: withdrawal.amount,
      referenceId: withdrawal.id,
      description: `คืนวงเงินจากคำขอถอนที่ถูกปฏิเสธ ${withdrawal.reference}`,
    });
    const updated = await this.repos.withdrawals.update(withdrawalId, {
      status: 'rejected',
      settlementTransactionId: transaction.id,
      reviewedByUserId: context.actorId,
      reviewedAt,
      note: note || 'ข้อมูลบัญชีไม่ถูกต้อง',
    });
    await this.notifications.push({
      userId: withdrawal.userId,
      type: 'withdrawal',
      title: 'คำขอถอนเงินถูกปฏิเสธ',
      body: `${formatMoney(withdrawal.amount)} ถูกคืนเข้ากระเป๋าเงินแล้ว`,
      href: '/account/withdrawals',
    });
    await this.audit.record(context, {
      action: AUDIT_ACTIONS.ADMIN_REJECT_WITHDRAWAL,
      resource: 'withdrawal',
      resourceId: withdrawalId,
      before: { status: 'pending', amount: withdrawal.amount },
      after: { status: 'rejected', note },
    });
    return updated;
  }

  /** Admin manual adjustment — always audited, always through the ledger. */
  async adjustWallet(
    input: { userId: string; amountBaht: number; reason: string },
    context: AuditContext,
  ) {
    const amount = bahtToSatang(Math.abs(input.amountBaht));
    const isCredit = input.amountBaht > 0;

    const { wallet, transaction } = isCredit
      ? await this.wallet.credit({
          userId: input.userId,
          type: 'adjustment',
          amount,
          description: `ปรับปรุงยอดโดยเจ้าหน้าที่: ${input.reason}`,
          referenceId: context.actorId,
          referenceType: 'adjustment',
        })
      : await this.wallet.debit({
          userId: input.userId,
          type: 'adjustment',
          amount,
          description: `ปรับปรุงยอดโดยเจ้าหน้าที่: ${input.reason}`,
          referenceId: context.actorId,
          referenceType: 'adjustment',
        });

    await this.notifications.push({
      userId: input.userId,
      type: 'wallet',
      title: 'มีการปรับปรุงยอดเงิน',
      body: `${isCredit ? '+' : '-'}${formatMoney(amount)} • ${input.reason}`,
      href: '/account/transactions',
    });
    await this.audit.record(context, {
      action: AUDIT_ACTIONS.ADMIN_ADJUST_WALLET,
      resource: 'wallet',
      resourceId: wallet.id,
      before: { balance: transaction.balanceBefore },
      after: { balance: transaction.balanceAfter, reason: input.reason },
    });

    return { wallet, transaction };
  }
}
