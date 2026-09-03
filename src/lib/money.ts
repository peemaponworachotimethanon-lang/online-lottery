/**
 * Money handling.
 *
 * DECISION: money is represented as an **integer number of minor units (satang)**,
 * never as a float. Rationale:
 *   - Thai lottery stakes and payouts are whole-satang amounts; no sub-satang math
 *     is ever required, so a decimal type buys nothing over integers.
 *   - Integer arithmetic is exact, cheap, and trivially serialisable across the
 *     server/client boundary.
 *   - JavaScript's safe integer range (2^53-1) covers ~9.0e13 THB, which is far
 *     beyond any plausible balance, so `number` is safe in the application layer.
 *   - In PostgreSQL these columns are `BIGINT` (Prisma `BigInt`), which is exact
 *     and leaves headroom well past the JS safe range if the product ever needs it.
 *
 * Every amount in the domain is a `Satang`. Formatting to a THB string happens
 * only at the presentation edge.
 */

export type Satang = number;

export const SATANG_PER_BAHT = 100;

/** Convert a baht amount (possibly fractional) to satang, rounding half-up. */
export function bahtToSatang(baht: number): Satang {
  return Math.round(baht * SATANG_PER_BAHT);
}

/** Convert satang to a baht number. Only for display/serialisation, never for math. */
export function satangToBaht(satang: Satang): number {
  return satang / SATANG_PER_BAHT;
}

export function assertSatang(value: number, label = 'amount'): asserts value is Satang {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer number of satang, received ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} exceeds the safe integer range`);
  }
}

/**
 * Multiply a stake by a payout rate.
 * Rates are stored as integer basis points of "x" (rateBp), i.e. x90 === 900_000
 * basis points is overkill; we instead store `rateMilli` = rate * 1000 so that
 * fractional rates such as x92.5 are representable exactly as integers.
 */
export function applyRate(stakeSatang: Satang, rateMilli: number): Satang {
  assertSatang(stakeSatang, 'stake');
  if (!Number.isInteger(rateMilli) || rateMilli < 0) {
    throw new TypeError(`rateMilli must be a non-negative integer, received ${rateMilli}`);
  }
  // Floor so the house never over-pays by a rounding error.
  return Math.floor((stakeSatang * rateMilli) / 1000);
}

/** Human display rate, e.g. 850000 -> "850" and 92500 -> "92.5". */
export function formatRate(rateMilli: number): string {
  const value = rateMilli / 1000;
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}

export function rateFromX(x: number): number {
  return Math.round(x * 1000);
}

const bahtFormatter = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** `12345678` -> `"123,456.78"` */
export function formatSatang(satang: Satang): string {
  return bahtFormatter.format(satangToBaht(satang));
}

/** `12345678` -> `"฿123,456.78"` */
export function formatMoney(satang: Satang): string {
  const negative = satang < 0;
  const body = bahtFormatter.format(Math.abs(satangToBaht(satang)));
  return `${negative ? '-' : ''}฿${body}`;
}

/** Drops the decimals when the amount is whole baht — used in dense tables. */
export function formatMoneyCompact(satang: Satang): string {
  const negative = satang < 0;
  const abs = Math.abs(satang);
  const body =
    abs % SATANG_PER_BAHT === 0
      ? compactFormatter.format(abs / SATANG_PER_BAHT)
      : bahtFormatter.format(abs / SATANG_PER_BAHT);
  return `${negative ? '-' : ''}฿${body}`;
}

/**
 * Splits a formatted amount into sign, symbol and digits.
 *
 * The ฿ glyph comes from a different font in the fallback stack than the digits,
 * and applying `tabular-nums` to the combined string makes the symbol collide
 * with the first digit. Rendering the symbol in its own element avoids that.
 */
export function moneyParts(satang: Satang): { sign: string; symbol: string; body: string } {
  return {
    sign: satang < 0 ? '-' : '',
    symbol: '฿',
    body: bahtFormatter.format(Math.abs(satangToBaht(satang))),
  };
}

export function moneyPartsCompact(satang: Satang): { sign: string; symbol: string; body: string } {
  const abs = Math.abs(satang);
  return {
    sign: satang < 0 ? '-' : '',
    symbol: '฿',
    body:
      abs % SATANG_PER_BAHT === 0
        ? compactFormatter.format(abs / SATANG_PER_BAHT)
        : bahtFormatter.format(abs / SATANG_PER_BAHT),
  };
}

/** Signed variant used in ledger tables: `+฿100.00` / `-฿100.00`. */
export function formatMoneySigned(satang: Satang): string {
  const sign = satang > 0 ? '+' : satang < 0 ? '-' : '';
  return `${sign}฿${bahtFormatter.format(Math.abs(satangToBaht(satang)))}`;
}
