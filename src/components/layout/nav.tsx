'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

export function useIsActive() {
  const pathname = usePathname();
  return (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav({ items }: { items: NavItem[] }) {
  const isActive = useIsActive();
  return (
    <nav aria-label="เมนูหลัก" className="hidden items-center gap-1 md:flex">
      {items.map((item) => {
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary-soft text-primary-soft-foreground'
                : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SideNav({
  items,
  onNavigate,
  className,
}: {
  items: Array<NavItem & { icon?: React.ReactNode }>;
  onNavigate?: () => void;
  className?: string;
}) {
  const isActive = useIsActive();
  return (
    <nav aria-label="เมนู" className={cn('flex flex-col gap-0.5', className)}>
      {items.map((item) => {
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-sm whitespace-nowrap transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
              active
                ? 'bg-primary-soft font-medium text-primary-soft-foreground'
                : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
            )}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
