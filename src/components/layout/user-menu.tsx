'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  Ticket,
  User as UserIcon,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Money } from '@/components/ui/money';
import { logoutAction } from '@/server/actions/auth-actions';
import type { NotificationDto } from '@/types/dto';
import type { PublicUser } from '@/types/domain';
import { relativeFromNow } from '@/lib/datetime';

export function UserMenu({
  user,
  balance,
  isStaff,
}: {
  user: PublicUser;
  balance: number;
  isStaff: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 pl-2 pr-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground">
            {user.displayName.slice(0, 1)}
          </span>
          <span className="hidden max-w-28 truncate text-sm sm:inline">{user.displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-medium text-foreground">{user.displayName}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1.5 text-sm">
          <span className="text-muted-foreground">ยอดเงิน</span>
          <Money value={balance} className="font-semibold" />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboard /> แดชบอร์ด
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/bets">
            <Ticket /> ประวัติการแทง
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/wallet">
            <Wallet /> กระเป๋าเงิน
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserIcon /> โปรไฟล์
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/settings">
            <Settings /> ตั้งค่า
          </Link>
        </DropdownMenuItem>
        {isStaff ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <Shield /> ระบบผู้ดูแล
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            startTransition(async () => {
              await logoutAction();
              router.refresh();
            });
          }}
        >
          <LogOut /> ออกจากระบบ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NotificationBell({
  notifications,
  unread,
}: {
  notifications: NotificationDto[];
  unread: number;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={unread > 0 ? `การแจ้งเตือน ${unread} รายการที่ยังไม่อ่าน` : 'การแจ้งเตือน'}
        >
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="tabular absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-danger-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>การแจ้งเตือน</span>
          {unread > 0 ? <Badge variant="emerald">{unread} ใหม่</Badge> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">ยังไม่มีการแจ้งเตือน</p>
        ) : (
          <div className="scrollbar-thin max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem key={notification.id} asChild>
                <Link href={notification.href ?? '/account/notifications'} className="flex-col items-start gap-0.5">
                  <span className="flex w-full items-center gap-2">
                    {notification.readAt === null ? (
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />
                    ) : null}
                    <span className="truncate text-sm font-medium">{notification.title}</span>
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {relativeFromNow(notification.createdAt)}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account/notifications" className="justify-center text-sm text-primary">
            ดูทั้งหมด
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
