import * as React from 'react';
import { moneyParts, moneyPartsCompact, type Satang } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Money display.
 *
 * Gold (`tone="prize"`) is reserved for winnings and reward amounts. Ordinary
 * balances and stakes use the normal foreground colour.
 */
export function Money({
  value,
  tone = 'default',
  signed = false,
  compact = false,
  className,
}: {
  value: Satang;
  tone?: 'default' | 'muted' | 'prize' | 'positive' | 'negative' | 'auto';
  signed?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const resolved = tone === 'auto' ? (value > 0 ? 'positive' : value < 0 ? 'negative' : 'muted') : tone;
  const parts = compact ? moneyPartsCompact(value) : moneyParts(value);
  const sign = signed && value > 0 ? '+' : parts.sign;

  return (
    <span
      className={cn(
        'inline-flex items-baseline',
        resolved === 'muted' && 'text-muted-foreground',
        resolved === 'prize' && 'font-semibold text-accent',
        resolved === 'positive' && 'text-primary',
        resolved === 'negative' && 'text-danger',
        className,
      )}
    >
      {sign ? <span aria-hidden={false}>{sign}</span> : null}
      <span className="mr-[0.15em]">{parts.symbol}</span>
      <span className="tabular">{parts.body}</span>
    </span>
  );
}
