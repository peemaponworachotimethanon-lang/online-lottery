'use client';

import { create } from 'zustand';
import { bahtToSatang } from '@/lib/money';
import type { BetTypeDto } from '@/types/dto';

/**
 * Bet slip state.
 *
 * The slip is intentionally client-only and holds *intent*, not money: stakes are
 * plain baht integers and payouts shown here are previews. The server re-prices
 * and re-validates the entire slip on submit, so nothing in this store can affect
 * what is actually charged.
 *
 * The slip is scoped to one round. Switching rounds clears it, which prevents the
 * classic bug of submitting yesterday's numbers into today's round.
 */
export interface SlipItem {
  /** Stable client id so React keys survive edits. */
  key: string;
  betTypeCode: string;
  betTypeName: string;
  number: string;
  stakeBaht: number;
  rateMilli: number;
}

interface BetSlipState {
  roundId: string | null;
  lotterySlug: string | null;
  lotteryName: string | null;
  closeAt: string | null;
  items: SlipItem[];
  /** Bumped on every successful submit so a stale idempotency key is never reused. */
  submissionNonce: number;

  setContext: (context: {
    roundId: string;
    lotterySlug: string;
    lotteryName: string;
    closeAt: string;
  }) => void;
  add: (input: { betType: BetTypeDto; number: string; stakeBaht: number }) => 'added' | 'merged';
  addMany: (inputs: Array<{ betType: BetTypeDto; number: string; stakeBaht: number }>) => number;
  updateStake: (key: string, stakeBaht: number) => void;
  duplicate: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  reset: () => void;
}

let counter = 0;
const nextKey = () => `slip-${++counter}`;

export const useBetSlip = create<BetSlipState>((set, get) => ({
  roundId: null,
  lotterySlug: null,
  lotteryName: null,
  closeAt: null,
  items: [],
  submissionNonce: 0,

  setContext: (context) => {
    const state = get();
    if (state.roundId === context.roundId) {
      set({ ...context });
      return;
    }
    // Different round -> the previous slip is no longer meaningful.
    set({ ...context, items: [] });
  },

  add: ({ betType, number, stakeBaht }) => {
    const items = get().items;
    const existing = items.find(
      (item) => item.betTypeCode === betType.code && item.number === number,
    );

    if (existing) {
      set({
        items: items.map((item) =>
          item.key === existing.key ? { ...item, stakeBaht: item.stakeBaht + stakeBaht } : item,
        ),
      });
      return 'merged';
    }

    set({
      items: [
        ...items,
        {
          key: nextKey(),
          betTypeCode: betType.code,
          betTypeName: betType.nameTh,
          number,
          stakeBaht,
          rateMilli: betType.rateMilli,
        },
      ],
    });
    return 'added';
  },

  addMany: (inputs) => {
    let added = 0;
    for (const input of inputs) {
      get().add(input);
      added += 1;
    }
    return added;
  },

  updateStake: (key, stakeBaht) =>
    set({
      items: get().items.map((item) =>
        item.key === key ? { ...item, stakeBaht: Math.max(0, Math.trunc(stakeBaht)) } : item,
      ),
    }),

  duplicate: (key) => {
    const items = get().items;
    const source = items.find((item) => item.key === key);
    if (!source) return;
    const index = items.findIndex((item) => item.key === key);
    const copy = { ...source, key: nextKey() };
    set({ items: [...items.slice(0, index + 1), copy, ...items.slice(index + 1)] });
  },

  remove: (key) => set({ items: get().items.filter((item) => item.key !== key) }),
  clear: () => set({ items: [] }),
  reset: () =>
    set({
      roundId: null,
      lotterySlug: null,
      lotteryName: null,
      closeAt: null,
      items: [],
      submissionNonce: get().submissionNonce + 1,
    }),
}));

/** Derived totals. Preview only — the server is authoritative. */
export function slipTotals(items: readonly SlipItem[]) {
  let totalStakeBaht = 0;
  let totalPotentialSatang = 0;
  for (const item of items) {
    totalStakeBaht += item.stakeBaht;
    totalPotentialSatang += Math.floor((bahtToSatang(item.stakeBaht) * item.rateMilli) / 1000);
  }
  return {
    count: items.length,
    totalStakeBaht,
    totalStakeSatang: bahtToSatang(totalStakeBaht),
    totalPotentialSatang,
  };
}
