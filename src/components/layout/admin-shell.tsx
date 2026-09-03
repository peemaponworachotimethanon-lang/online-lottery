'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Bell,
  ClipboardList,
  Coins,
  CreditCard,
  FileClock,
  Gauge,
  Landmark,
  LayoutGrid,
  ListChecks,
  Menu,
  Percent,
  Settings,
  Ticket,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  DialogTitle,
  DialogHeader,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Logo } from './logo';
import { SideNav } from './nav';
import { ThemeToggle } from './theme';

const NAV_GROUPS: Array<{
  title: string;
  items: Array<{ href: string; label: string; icon: React.ReactNode; exact?: boolean }>;
}> = [
  {
    title: 'ภาพรวม',
    items: [
      { href: '/admin', label: 'แดชบอร์ด', icon: <Gauge />, exact: true },
      { href: '/admin/reports', label: 'รายงาน', icon: <BarChart3 /> },
    ],
  },
  {
    title: 'ผู้ใช้และการเงิน',
    items: [
      { href: '/admin/users', label: 'ผู้ใช้งาน', icon: <Users /> },
      { href: '/admin/wallet', label: 'กระเป๋าเงิน', icon: <Wallet /> },
      { href: '/admin/transactions', label: 'ธุรกรรม', icon: <Coins /> },
      { href: '/admin/deposits', label: 'การฝากเงิน', icon: <CreditCard /> },
      { href: '/admin/withdrawals', label: 'การถอนเงิน', icon: <Landmark /> },
    ],
  },
  {
    title: 'หวยและการแทง',
    items: [
      { href: '/admin/lotteries', label: 'จัดการหวย', icon: <LayoutGrid /> },
      { href: '/admin/rounds', label: 'จัดการงวด', icon: <ListChecks /> },
      { href: '/admin/bet-types', label: 'ประเภทการแทง', icon: <Ticket /> },
      { href: '/admin/payout-rates', label: 'อัตราจ่าย', icon: <Percent /> },
      { href: '/admin/bets', label: 'บิลแทง', icon: <ClipboardList /> },
      { href: '/admin/results', label: 'ผลรางวัลและเคลียร์', icon: <Trophy /> },
    ],
  },
  {
    title: 'ระบบ',
    items: [
      { href: '/admin/notifications', label: 'การแจ้งเตือน', icon: <Bell /> },
      { href: '/admin/audit-logs', label: 'บันทึกการใช้งาน', icon: <FileClock /> },
      { href: '/admin/settings', label: 'ตั้งค่าระบบ', icon: <Settings /> },
    ],
  },
];

function NavGroups({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="space-y-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className="space-y-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.title}
          </p>
          <SideNav items={group.items} onNavigate={onNavigate} />
        </div>
      ))}
    </div>
  );
}

/**
 * Admin shell.
 *
 * Desktop: fixed sidebar + sticky header.
 * Tablet/mobile: the same navigation inside a slide-in drawer, so the admin is
 * usable one-handed on a phone rather than a shrunken desktop table view.
 */
export function AdminShell({
  children,
  displayName,
  roleLabel,
  pendingCount,
}: {
  children: React.ReactNode;
  displayName: string;
  roleLabel: string;
  pendingCount: number;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex min-h-dvh bg-surface-muted">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">
        <div className="sticky top-0 flex h-dvh flex-col">
          <div className="flex h-14 items-center border-b border-border px-4">
            <Logo href="/admin" />
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto p-3">
            <NavGroups />
          </div>
          <div className="border-t border-border p-3">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur sm:px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="เปิดเมนูผู้ดูแล">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <DialogHeader className="border-b border-border">
                <DialogTitle>
                  <Logo href="/admin" />
                </DialogTitle>
              </DialogHeader>
              <div className="scrollbar-thin flex-1 overflow-y-auto p-3">
                <NavGroups onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="lg:hidden">
            <Logo href="/admin" showWordmark={false} />
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm font-medium sm:inline">ระบบผู้ดูแล</span>
            {pendingCount > 0 ? (
              <Badge variant="warning">รอดำเนินการ {pendingCount}</Badge>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <Button asChild variant="outline" size="sm">
              <Link href="/">ไปหน้าเว็บ</Link>
            </Button>
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
