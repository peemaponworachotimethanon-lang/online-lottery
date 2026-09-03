'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/errors';
import { depositSchema, withdrawalSchema, type DepositInput, type WithdrawalInput } from '@/schemas/betting';
import { auditContext, enforceRateLimit, requireUser } from '@/server/context';
import { getServices } from '@/services/container';

export interface CashierResult {
  id: string;
  reference: string;
  amount: number;
  status: string;
  balance: number;
  held: number;
  replayed: boolean;
}

export async function simulateDepositAction(raw: DepositInput): Promise<ActionResult<CashierResult>> {
  try {
    const user = await requireUser();
    const input = depositSchema.parse(raw);
    await enforceRateLimit('deposit', user.id);

    const services = getServices();
    const context = await auditContext(user);
    const { deposit, replayed } = await services.cashier.createMockDeposit(user.id, input, context);
    const wallet = await services.wallet.getWallet(user.id);

    revalidatePath('/wallet');
    revalidatePath('/account/transactions');
    revalidatePath('/dashboard');

    return ok({
      id: deposit.id,
      reference: deposit.reference,
      amount: deposit.amount,
      status: deposit.status,
      balance: wallet.balance,
      held: wallet.held,
      replayed,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function requestWithdrawalAction(
  raw: WithdrawalInput,
): Promise<ActionResult<CashierResult>> {
  try {
    const user = await requireUser();
    const input = withdrawalSchema.parse(raw);
    await enforceRateLimit('withdrawal', user.id);

    const services = getServices();
    const context = await auditContext(user);
    const { withdrawal, replayed } = await services.cashier.requestWithdrawal(user.id, input, context);
    const wallet = await services.wallet.getWallet(user.id);

    revalidatePath('/wallet');
    revalidatePath('/account/withdrawals');
    revalidatePath('/dashboard');

    return ok({
      id: withdrawal.id,
      reference: withdrawal.reference,
      amount: withdrawal.amount,
      status: withdrawal.status,
      balance: wallet.balance,
      held: wallet.held,
      replayed,
    });
  } catch (error) {
    return fail(error);
  }
}
