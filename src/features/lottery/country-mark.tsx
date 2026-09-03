import { cn } from '@/lib/utils';

/**
 * Country marker.
 *
 * A tinted monogram rather than a flag emoji: emoji flags render inconsistently
 * across platforms (and not at all on some Windows builds), which would break the
 * card's visual rhythm.
 */
const TINTS: Record<string, string> = {
  TH: 'bg-primary-soft text-primary-soft-foreground',
  LA: 'bg-accent-soft text-accent-foreground',
  VN: 'bg-danger-soft text-danger',
  JP: 'bg-surface-muted text-foreground',
  CN: 'bg-warning-soft text-warning-foreground',
  HK: 'bg-primary-soft text-primary-soft-foreground',
  US: 'bg-surface-muted text-foreground',
};

export function CountryMark({ code, className }: { code: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-[10px] text-xs font-semibold tracking-wide',
        TINTS[code] ?? 'bg-surface-muted text-muted-foreground',
        className,
      )}
    >
      {code}
    </span>
  );
}
