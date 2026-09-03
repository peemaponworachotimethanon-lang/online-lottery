import { describe, expect, it } from 'vitest';
import {
  applyRate,
  assertSatang,
  bahtToSatang,
  formatMoney,
  formatRate,
  rateFromX,
  satangToBaht,
} from '@/lib/money';

describe('money', () => {
  it('converts baht to satang without floating point drift', () => {
    expect(bahtToSatang(100)).toBe(10_000);
    expect(bahtToSatang(0.1)).toBe(10);
    expect(bahtToSatang(19.99)).toBe(1999);
    // The classic float trap: 0.1 + 0.2 !== 0.3 in floats, but is exact in satang.
    expect(bahtToSatang(0.1) + bahtToSatang(0.2)).toBe(bahtToSatang(0.3));
  });

  it('round-trips satang to baht', () => {
    expect(satangToBaht(10_000)).toBe(100);
  });

  it('rejects non-integer satang', () => {
    expect(() => assertSatang(10.5)).toThrow(TypeError);
    expect(() => assertSatang(Number.MAX_SAFE_INTEGER + 2)).toThrow();
  });

  it('applies payout rates exactly', () => {
    // 100 THB at x850 = 85,000 THB — the headline demo scenario.
    expect(applyRate(bahtToSatang(100), rateFromX(850))).toBe(bahtToSatang(85_000));
    expect(applyRate(bahtToSatang(50), rateFromX(90))).toBe(bahtToSatang(4_500));
  });

  it('supports fractional rates without losing precision', () => {
    expect(applyRate(bahtToSatang(100), rateFromX(3.2))).toBe(bahtToSatang(320));
    expect(applyRate(bahtToSatang(1), rateFromX(4.2))).toBe(bahtToSatang(4.2));
  });

  it('never over-pays on rounding', () => {
    // 1 satang at x3.2 = 3.2 satang, which must floor to 3.
    expect(applyRate(1, rateFromX(3.2))).toBe(3);
  });

  it('formats rates and money for display', () => {
    expect(formatRate(rateFromX(850))).toBe('850');
    expect(formatMoney(bahtToSatang(1234.5))).toBe('฿1,234.50');
    expect(formatMoney(-bahtToSatang(100))).toBe('-฿100.00');
  });
});
