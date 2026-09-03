import { describe, expect, it } from 'vitest';
import {
  displayRoundStatus,
  isRoundAcceptingBets,
  isWinningNumber,
  permutationVariants,
  permutationsOf3,
  reverseNumber,
  tripleDigitNumbers,
} from '@/lib/lottery-rules';

const result = { top3: '123', top2: '23', bottom2: '45' };

describe('isWinningNumber', () => {
  it('matches an exact 3-digit top', () => {
    expect(isWinningNumber('exact-top-3', '123', result)).toBe(true);
    expect(isWinningNumber('exact-top-3', '132', result)).toBe(false);
  });

  it('matches any permutation for tote', () => {
    for (const candidate of ['123', '132', '213', '231', '312', '321']) {
      expect(isWinningNumber('permutation-top-3', candidate, result)).toBe(true);
    }
    expect(isWinningNumber('permutation-top-3', '124', result)).toBe(false);
  });

  it('matches 2-digit top and bottom independently', () => {
    expect(isWinningNumber('exact-top-2', '23', result)).toBe(true);
    expect(isWinningNumber('exact-top-2', '45', result)).toBe(false);
    expect(isWinningNumber('exact-bottom-2', '45', result)).toBe(true);
  });

  it('matches running digits', () => {
    for (const digit of ['1', '2', '3']) {
      expect(isWinningNumber('running-top', digit, result)).toBe(true);
    }
    expect(isWinningNumber('running-top', '4', result)).toBe(false);
    expect(isWinningNumber('running-bottom', '4', result)).toBe(true);
    expect(isWinningNumber('running-bottom', '1', result)).toBe(false);
  });

  it('handles repeated digits in permutations without duplicates', () => {
    expect(permutationsOf3('112')).toEqual(expect.arrayContaining(['112', '121', '211']));
    expect(new Set(permutationsOf3('111')).size).toBe(1);
  });
});

describe('round status', () => {
  const base = {
    status: 'open' as const,
    openAt: '2026-09-03T00:00:00.000Z',
    closeAt: '2026-09-03T10:00:00.000Z',
  };

  it('derives status from server time, not the stored column', () => {
    expect(displayRoundStatus(base, Date.parse('2026-09-02T23:00:00Z'))).toBe('scheduled');
    expect(displayRoundStatus(base, Date.parse('2026-09-03T05:00:00Z'))).toBe('open');
    expect(displayRoundStatus(base, Date.parse('2026-09-03T09:45:00Z'))).toBe('closing-soon');
    expect(displayRoundStatus(base, Date.parse('2026-09-03T10:00:01Z'))).toBe('closed');
  });

  it('honours terminal stored statuses', () => {
    expect(displayRoundStatus({ ...base, status: 'settled' }, Date.parse('2026-09-03T05:00:00Z'))).toBe(
      'settled',
    );
    expect(displayRoundStatus({ ...base, status: 'cancelled' }, Date.now())).toBe('cancelled');
  });

  it('accepts bets only while open or closing soon', () => {
    expect(isRoundAcceptingBets(base, Date.parse('2026-09-03T05:00:00Z'))).toBe(true);
    expect(isRoundAcceptingBets(base, Date.parse('2026-09-03T09:59:59Z'))).toBe(true);
    expect(isRoundAcceptingBets(base, Date.parse('2026-09-03T10:00:00Z'))).toBe(false);
    expect(isRoundAcceptingBets(base, Date.parse('2026-09-02T20:00:00Z'))).toBe(false);
  });
});

describe('number helpers', () => {
  it('reverses and permutes', () => {
    expect(reverseNumber('12')).toBe('21');
    expect(permutationVariants('12')).toEqual(['21']);
    expect(permutationVariants('11')).toEqual([]);
    expect(permutationVariants('123')).toHaveLength(5);
  });

  it('builds the triple-digit set', () => {
    expect(tripleDigitNumbers()).toHaveLength(10);
    expect(tripleDigitNumbers()[7]).toBe('777');
  });
});
