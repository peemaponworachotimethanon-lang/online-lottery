'use client';

import Link from 'next/link';
import { Home, Ticket, ClipboardList, Wallet, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsActive } from './nav';

const ITEMS = [
  { href: '/', label: 'หน้าแรก', icon: Home, exact: true },
  { href: '/lotteries', label: 'หวย', icon: Ticket },
  { href: '/bet-slip', label: 'โพยหวย', icon: ClipboardList },
  { href: '/wallet', label: 'กระเป๋าเงิน', icon: Wallet },
  { href: '/account', label: 'บัญชี', icon: User },
];

/**
 * Mobile bottom navigation.
 *
 * Five destinations, thumb-reachable, with the bet slip in the middle because it
 * is the highest-frequency action on a phone.
 */
export function MobileNav() {
  const isActive = useIsActive();

  return (
    <nav
      aria-label="เมนูด้านล่าง"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
