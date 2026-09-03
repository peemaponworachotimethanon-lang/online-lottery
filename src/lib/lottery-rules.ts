import type {
  BetType,
  DisplayRoundStatus,
  LotteryResult,
  LotteryRound,
  MatchStrategy,
} from '@/types/domain';

/**
 * Pure domain rules. No I/O, no framework imports — this module is the single
 * place where "does this number win?" is decided, and it is unit tested directly.
 */

/** A round enters the `closing-soon` display state this many minutes before close. */
export const CLOSING_SOON_MINUTES = 30;

export function permutationsOf3(digits: string): string[] {
  const [a, b, c] = [digits[0] ?? '', digits[1] ?? '', digits[2] ?? ''];
  return Array.from(new Set([a + b + c, a + c + b, b + a + c, b + c + a, c + a + b, c + b + a]));
}

/** Digits that count as "running" (วิ่ง) for the top prize: every digit of top3. */
export function runningTopDigits(result: Pick<LotteryResult, 'top3'>): string[] {
  return Array.from(new Set(result.top3.split('')));
}

export function runningBottomDigits(result: Pick<LotteryResult, 'bottom2'>): string[] {
  return Array.from(new Set(result.bottom2.split('')));
}

/**
 * Decide whether `betNumber` wins under `strategy` for `result`.
 * Adding a bet type means adding a strategy here plus a data row — nothing else.
 */
export function isWinningNumber(
  strategy: MatchStrategy,
  betNumber: string,
  result: Pick<LotteryResult, 'top3' | 'top2' | 'bottom2'>,
): boolean {
  switch (strategy) {
    case 'exact-top-3':
      return betNumber === result.top3;
    case 'permutation-top-3':
      return permutationsOf3(result.top3).includes(betNumber);
    case 'exact-top-2':
      return betNumber === result.top2;
    case 'exact-bottom-2':
      return betNumber === result.bottom2;
    case 'running-top':
      return runningTopDigits(result).includes(betNumber);
    case 'running-bottom':
      return runningBottomDigits(result).includes(betNumber);
    default: {
      const exhaustive: never = strategy;
      throw new Error(`Unhandled match strategy: ${String(exhaustive)}`);
    }
  }
}

export function isValidNumberForType(betType: Pick<BetType, 'digitLength'>, value: string): boolean {
  return new RegExp(`^\\d{${betType.digitLength}}$`).test(value);
}

/* ------------------------------------------------------------------ */
/* Round status                                                        */
/* ------------------------------------------------------------------ */

/**
 * Derive the status the UI should show from *server* time.
 * The stored `status` column is authoritative for terminal states; the open /
 * closing-soon / closed distinction is always recomputed from the clock so a
 * stale row can never let a bet through after close.
 */
export function displayRoundStatus(
  round: Pick<LotteryRound, 'status' | 'openAt' | 'closeAt'>,
  nowMs: number = Date.now(),
): DisplayRoundStatus {
  if (round.status === 'cancelled') return 'cancelled';
  if (round.status === 'settled') return 'settled';
  if (round.status === 'resulted') return 'resulted';

  const openAt = new Date(round.openAt).getTime();
  const closeAt = new Date(round.closeAt).getTime();

  if (nowMs < openAt) return 'scheduled';
  if (nowMs >= closeAt) return 'closed';
  if (closeAt - nowMs <= CLOSING_SOON_MINUTES * 60_000) return 'closing-soon';
  return 'open';
}

/** The only predicate allowed to gate bet acceptance. */
export function isRoundAcceptingBets(
  round: Pick<LotteryRound, 'status' | 'openAt' | 'closeAt'>,
  nowMs: number = Date.now(),
): boolean {
  const status = displayRoundStatus(round, nowMs);
  return status === 'open' || status === 'closing-soon';
}

/* ------------------------------------------------------------------ */
/* Number helpers used by the fast bet entry UI                        */
/* ------------------------------------------------------------------ */

export function reverseNumber(value: string): string {
  return value.split('').reverse().join('');
}

/** All distinct permutations of a 2 or 3 digit number, excluding the original. */
export function permutationVariants(value: string): string[] {
  if (value.length === 2) {
    const reversed = reverseNumber(value);
    return reversed === value ? [] : [reversed];
  }
  if (value.length === 3) {
    return permutationsOf3(value).filter((candidate) => candidate !== value);
  }
  return [];
}

export function repeatedDigitNumbers(digitLength: number): string[] {
  return Array.from({ length: 10 }, (_, digit) => String(digit).repeat(digitLength));
}

/** 000, 111 … 999 — the classic "เลขตอง" set. */
export function tripleDigitNumbers(): string[] {
  return repeatedDigitNumbers(3);
}

/** `doorNumbers('1', 2)` -> 10..19 (front) — a common Thai quick-pick set. */
export function doorNumbers(digit: string, digitLength: number, position: 'front' | 'back'): string[] {
  const others = Array.from({ length: 10 }, (_, i) => String(i));
  if (digitLength !== 2) return [];
  return others.map((other) => (position === 'front' ? digit + other : other + digit));
}

export function randomNumber(digitLength: number, rng: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < digitLength; i++) out += String(Math.floor(rng() * 10));
  return out;
}
