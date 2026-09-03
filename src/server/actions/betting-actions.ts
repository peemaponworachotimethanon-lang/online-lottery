'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/errors';
import { placeBetSchema, type PlaceBetInput } from '@/schemas/betting';
import { auditContext, enforceRateLimit, requireUser } from '@/server/context';
import { getServices } from '@/services/container';
import type { BetQuote } from '@/services/bet-service';

export interface PlaceBetResult {
  betId: string;
  reference: string;
  totalStake: number;
  totalPotentialPayout: number;
  balanceAfter: number;
  replayed: boolean;
}

export async function quoteBetAction(raw: PlaceBetInput): Promise<ActionResult<BetQuote>> {
  try {
    const user = await requireUser();
    const input = placeBetSchema.parse(raw);
    const services = getServices();
    return ok(await services.bets.quote(user.id, input));
  } catch (error) {
    return fail(error);
  }
}

export async function placeBetAction(raw: PlaceBetInput): Promise<ActionResult<PlaceBetResult>> {
  try {
    const user = await requireUser();
    const input = placeBetSchema.parse(raw);
    await enforceRateLimit('placeBet', user.id);

    const services = getServices();
    const context = await auditContext(user);
    const { bet, replayed } = await services.bets.placeBet(user.id, input, context);
    const wallet = await services.wallet.getWallet(user.id);

    revalidatePath('/account/bets');
    revalidatePath('/dashboard');

    return ok({
      betId: bet.id,
      reference: bet.reference,
      totalStake: bet.totalStake,
      totalPotentialPayout: bet.totalPotentialPayout,
      balanceAfter: wallet.balance,
      replayed,
    });
  } catch (error) {
    return fail(error);
  }
}

/** Lightweight polling endpoint for the bet slip's balance line. */
export async function getWalletSnapshotAction(): Promise<
  ActionResult<{ balance: number; held: number }>
> {
  try {
    const user = await requireUser();
    const wallet = await getServices().wallet.getWallet(user.id);
    return ok({ balance: wallet.balance, held: wallet.held });
  } catch (error) {
    return fail(error);
  }
}
