import Link from 'next/link';
import { brand } from '@/config/brand';
import { cn } from '@/lib/utils';

/**
 * Logo placeholder.
 *
 * The mark is generated from tokens, and every string comes from `config/brand`,
 * so swapping in the final brand asset is a one-file change.
 */
export function Logo({
  href = '/',
  showWordmark = true,
  className,
}: {
  href?: string;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2.5 rounded-md', className)}
      aria-label={brand.name}
    >
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-sm"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6z" strokeLinejoin="round" />
          <path d="M12 8.4v7.2M8.8 10.4h6.4" strokeLinecap="round" />
        </svg>
      </span>
      {showWordmark ? (
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">{brand.name}</span>
          <span className="text-[10px] font-medium text-accent">{brand.themeConceptTh}</span>
        </span>
      ) : null}
    </Link>
  );
}
